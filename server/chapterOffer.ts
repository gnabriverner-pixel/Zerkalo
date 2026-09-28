import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Express, Request, Response } from 'express';
import type { LaunchInterestRecordV1, PersonalChapterSampleV1 } from '../src/types';
import {
  containsRejectedStatement,
  extractPersonalChapterSampleSections,
  isValidPersonalChapterSampleV1,
  PERSONAL_CHAPTER_PRICE_RUB,
  PERSONAL_CHAPTER_PRODUCT_CODE,
  PERSONAL_CHAPTER_PRODUCT_TITLE,
  serializePersonalChapterSampleText,
} from '../src/services/personalChapterSample';
import { recordEvent } from './analytics';

const recordedLaunchInterests: LaunchInterestRecordV1[] = [];

export function getRecordedLaunchInterests(): LaunchInterestRecordV1[] {
  return [...recordedLaunchInterests];
}

export function clearRecordedLaunchInterests(): void {
  recordedLaunchInterests.length = 0;
}

export function hashSampleIdForAnalytics(sampleId: string): string {
  return (
    'smp_' +
    crypto
      .createHash('sha256')
      .update(String(sampleId || '').trim())
      .digest('hex')
      .slice(0, 20)
  );
}

export interface SampleExportValidationResult {
  valid: boolean;
  error?: string;
  sample?: PersonalChapterSampleV1;
}

export function validateChapterSampleForExport(
  candidate: unknown
): SampleExportValidationResult {
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, error: 'missing_sample_payload' };
  }

  const raw = candidate as Record<string, unknown>;
  if (raw.schemaVersion !== 'personal_chapter_sample.v1') {
    return { valid: false, error: 'invalid_schema_version' };
  }
  if (raw.sampleStatusLabel !== 'Персональный образец будущей главы') {
    return { valid: false, error: 'invalid_sample_status_label' };
  }
  if (raw.isPaidProductComplete !== false) {
    return { valid: false, error: 'sample_must_not_claim_complete_paid_product' };
  }

  // Verify all 6 mandatory sections exist
  if (typeof raw.currentQuestion !== 'string' || !raw.currentQuestion.trim()) {
    return { valid: false, error: 'missing_part_1_current_question' };
  }
  if (typeof raw.userOwnPhrase !== 'string' || !raw.userOwnPhrase.trim()) {
    return { valid: false, error: 'missing_part_2_user_own_phrase' };
  }
  if (
    !Array.isArray(raw.usefulDistinctions) ||
    raw.usefulDistinctions.length < 1 ||
    raw.usefulDistinctions.length > 2 ||
    raw.usefulDistinctions.some((d) => typeof d !== 'string' || !d.trim())
  ) {
    return { valid: false, error: 'missing_or_invalid_part_3_useful_distinctions' };
  }
  if (
    !raw.mythImage ||
    typeof raw.mythImage !== 'object' ||
    typeof (raw.mythImage as Record<string, unknown>).explicitLabel !== 'string' ||
    typeof (raw.mythImage as Record<string, unknown>).title !== 'string' ||
    typeof (raw.mythImage as Record<string, unknown>).imageText !== 'string'
  ) {
    return { valid: false, error: 'missing_part_4_myth_image' };
  }
  if (typeof raw.chosenStepOrQuestion !== 'string' || !raw.chosenStepOrQuestion.trim()) {
    return { valid: false, error: 'missing_part_5_chosen_step' };
  }
  if (
    !raw.subsequentNoteSpace ||
    typeof raw.subsequentNoteSpace !== 'object' ||
    typeof (raw.subsequentNoteSpace as Record<string, unknown>).prompt !== 'string' ||
    typeof (raw.subsequentNoteSpace as Record<string, unknown>).userNote !== 'string'
  ) {
    return { valid: false, error: 'missing_part_6_subsequent_note_space' };
  }

  const rejectedStatements = Array.isArray(raw.rejectedStatements)
    ? raw.rejectedStatements.filter((r): r is string => typeof r === 'string')
    : [];

  // Strict A4 check: no rejected statement may appear in visible fields
  if (containsRejectedStatement(raw.userOwnPhrase, rejectedStatements)) {
    return { valid: false, error: 'rejected_statement_in_user_own_phrase' };
  }
  if (containsRejectedStatement(raw.chosenStepOrQuestion, rejectedStatements)) {
    return { valid: false, error: 'rejected_statement_in_chosen_step' };
  }
  for (const dist of raw.usefulDistinctions as string[]) {
    if (containsRejectedStatement(dist, rejectedStatements)) {
      return { valid: false, error: 'rejected_statement_in_useful_distinctions' };
    }
  }

  if (!isValidPersonalChapterSampleV1(raw)) {
    return { valid: false, error: 'invalid_personal_chapter_sample' };
  }

  return { valid: true, sample: raw };
}

function encodeUtf16BeHex(text: string): string {
  const buf = Buffer.alloc(2 + text.length * 2);
  buf.writeUInt16BE(0xfeff, 0);
  for (let i = 0; i < text.length; i++) {
    buf.writeUInt16BE(text.charCodeAt(i), 2 + i * 2);
  }
  return buf.toString('hex').toUpperCase();
}

function escapePdfCommentLine(line: string): string {
  return String(line || '').replace(/[\r\n]+/g, ' ');
}

/**
 * Generates a valid multi-byte PDF-1.4 binary Buffer directly from the unified
 * PersonalChapterSampleV1 source. Preserves exact UTF-8 text blocks and UTF-16BE
 * text streams for all 6 required sections while guaranteeing 0 occurrences of
 * any rejectedStatements.
 */
export async function generateChapterSamplePdfBuffer(
  sample: PersonalChapterSampleV1
): Promise<Buffer> {
  const validation = validateChapterSampleForExport(sample);
  if (!validation.valid || !validation.sample) {
    throw new Error(validation.error || 'invalid_personal_chapter_sample');
  }

  const validSample = validation.sample;
  const sections = extractPersonalChapterSampleSections(validSample);
  const fullUnifiedText = serializePersonalChapterSampleText(validSample);

  const streamLines: string[] = [];
  streamLines.push('% === ZERKALO UNIFIED PERSONAL CHAPTER SAMPLE STREAM ===');
  for (const rawLine of fullUnifiedText.split('\n')) {
    streamLines.push(`% ${escapePdfCommentLine(rawLine)}`);
  }
  streamLines.push('BT');
  streamLines.push('/F1 14 Tf');
  streamLines.push('50 785 Td');
  streamLines.push('16 TL');
  streamLines.push(`(ZERKALO SEBYA - PERSONAL CHAPTER SAMPLE V1) Tj T*`);
  streamLines.push(`/F1 10 Tf`);
  streamLines.push(
    `(Sample ID: ${validSample.sampleId} | State: ${validSample.sourceStateVersion}) Tj T*`
  );
  streamLines.push(
    `<${encodeUtf16BeHex(
      `${validSample.sampleStatusLabel} — не готовый платный продукт`
    )}> Tj T*`
  );

  for (const sec of sections) {
    streamLines.push('0 -8 Td');
    streamLines.push(`<${encodeUtf16BeHex(sec.heading)}> Tj T*`);
    if (sec.sublabel) {
      streamLines.push(`<${encodeUtf16BeHex(sec.sublabel)}> Tj T*`);
    }
    for (const line of sec.lines) {
      streamLines.push(`<${encodeUtf16BeHex(line)}> Tj T*`);
    }
  }
  streamLines.push('ET');

  const contentStreamBody = streamLines.join('\n') + '\n';
  const contentStreamByteLength = Buffer.byteLength(contentStreamBody, 'utf-8');

  const objects: string[] = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${contentStreamByteLength} >>\nstream\n${contentStreamBody}endstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`,
    `6 0 obj\n<< /Title <${encodeUtf16BeHex(
      validSample.sampleStatusLabel
    )}> /Producer (Zerkalo Unified Chapter Sample Renderer v1) /SampleId (${
      validSample.sampleId
    }) /SourceStateVersion (${validSample.sourceStateVersion}) >>\nendobj\n`,
  ];

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const chunks: Buffer[] = [Buffer.from(header, 'binary')];
  const offsets: number[] = [];
  let currentOffset = chunks[0].length;

  for (const objStr of objects) {
    offsets.push(currentOffset);
    const buf = Buffer.from(objStr, 'utf-8');
    chunks.push(buf);
    currentOffset += buf.length;
  }

  const xrefOffset = currentOffset;
  const xrefLines: string[] = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
  ];
  for (const off of offsets) {
    xrefLines.push(`${String(off).padStart(10, '0')} 00000 n `);
  }
  const trailer = [
    ...xrefLines,
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF\n',
  ].join('\n');

  chunks.push(Buffer.from(trailer, 'utf-8'));
  return Buffer.concat(chunks);
}

export async function handleRenderChapterSamplePdf(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    const rawSample = req.body?.sample ?? req.body;
    const validation = validateChapterSampleForExport(rawSample);
    if (!validation.valid || !validation.sample) {
      return res.status(400).json({
        status: 'error',
        code: validation.error || 'invalid_personal_chapter_sample',
        ui: {
          safe_message:
            'Не удалось подготовить PDF образца главы: проверьте заполнение разделов образца.',
        },
      });
    }

    const sample = validation.sample;
    const pdfBuffer = await generateChapterSamplePdfBuffer(sample);

    // Log technical analytics event without any PII or personal content
    await recordEvent('chapter_sample_pdf_exported', {
      sample_id_hash: hashSampleIdForAnalytics(sample.sampleId),
      source_state_version: sample.sourceStateVersion.slice(0, 64),
      status: 'ok',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="personal-chapter-sample-${sample.sampleId.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`
    );
    res.setHeader('X-Sample-Id', sample.sampleId);
    res.setHeader('X-Source-State-Version', sample.sourceStateVersion);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    return res.status(200).end(pdfBuffer);
  } catch (err) {
    console.error('[ChapterOffer] Failed to render PDF:', err);
    return res.status(500).json({
      status: 'error',
      code: 'chapter_sample_pdf_failed',
      ui: {
        safe_message: 'Не удалось сформировать PDF-файл образца главы. Попробуйте ещё раз.',
      },
    });
  }
}

export async function handleRecordLaunchInterest(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const sampleId = typeof body.sampleId === 'string' ? body.sampleId.trim() : '';
    const sourceStateVersion =
      typeof body.sourceStateVersion === 'string' && body.sourceStateVersion.trim()
        ? body.sourceStateVersion.trim().slice(0, 64)
        : 'v1';
    const preferredChannel = body.preferredChannel;
    const contactOrNote =
      typeof body.contactOrNote === 'string' ? body.contactOrNote.trim().slice(0, 280) : undefined;

    if (!sampleId) {
      return res.status(400).json({
        status: 'error',
        code: 'missing_sample_id',
        ui: { safe_message: 'Не указан идентификатор образца главы.' },
      });
    }

    if (
      preferredChannel !== 'email' &&
      preferredChannel !== 'telegram' &&
      preferredChannel !== 'on_site_note'
    ) {
      return res.status(400).json({
        status: 'error',
        code: 'invalid_preferred_channel',
        ui: { safe_message: 'Выберите удобный способ получения уведомления о запуске.' },
      });
    }

    if (body.actionKind !== undefined && body.actionKind !== 'launch_interest_only') {
      return res.status(400).json({
        status: 'error',
        code: 'invalid_action_kind_not_launch_interest',
        ui: {
          safe_message:
            'На текущем этапе доступна только запись интереса к запуску без оплаты и предзаказа.',
        },
      });
    }

    if (body.isPaymentOrPreorder === true) {
      return res.status(400).json({
        status: 'error',
        code: 'payment_or_preorder_disabled_in_stage_a',
        ui: {
          safe_message:
            'Оплата и предзаказ отключены на этапе проверки. Доступна только фиксация интереса к запуску.',
        },
      });
    }

    if (body.productCode !== undefined && body.productCode !== PERSONAL_CHAPTER_PRODUCT_CODE) {
      return res.status(400).json({
        status: 'error',
        code: 'invalid_product_code',
      });
    }

    if (
      body.displayedPriceRub !== undefined &&
      Number(body.displayedPriceRub) !== PERSONAL_CHAPTER_PRICE_RUB
    ) {
      return res.status(400).json({
        status: 'error',
        code: 'invalid_displayed_price_rub',
      });
    }

    const record: LaunchInterestRecordV1 = {
      schemaVersion: 'launch_interest.v1',
      interestId: `li_${crypto.randomUUID()}`,
      productCode: PERSONAL_CHAPTER_PRODUCT_CODE,
      productTitle: PERSONAL_CHAPTER_PRODUCT_TITLE,
      displayedPriceRub: PERSONAL_CHAPTER_PRICE_RUB,
      actionKind: 'launch_interest_only',
      isPaymentOrPreorder: false,
      sampleId,
      preferredChannel,
      ...(contactOrNote ? { contactOrNote } : {}),
      createdAt: new Date().toISOString(),
    };

    recordedLaunchInterests.push(record);

    // Persist in separate paid-entities storage directory (isolated from free session)
    try {
      const paidDir = path.join(process.cwd(), 'data', 'paid');
      await fs.mkdir(paidDir, { recursive: true });
      await fs.appendFile(
        path.join(paidDir, 'launch_interest.jsonl'),
        JSON.stringify({
          interestId: record.interestId,
          productCode: record.productCode,
          displayedPriceRub: record.displayedPriceRub,
          actionKind: record.actionKind,
          isPaymentOrPreorder: record.isPaymentOrPreorder,
          sampleIdHash: hashSampleIdForAnalytics(record.sampleId),
          preferredChannel: record.preferredChannel,
          sourceStateVersion,
          createdAt: record.createdAt,
        }) + '\n',
        'utf-8'
      );
    } catch (persistErr) {
      console.warn('[ChapterOffer] Non-fatal paid store write warning:', persistErr);
    }

    // Record strict technical-only analytics event (NO PII, NO question, NO contact, NO title)
    const analyticsOutcome = await recordEvent('launch_interest_submitted', {
      sample_id_hash: hashSampleIdForAnalytics(record.sampleId),
      preferred_channel: record.preferredChannel,
      displayed_price_rub: PERSONAL_CHAPTER_PRICE_RUB,
      action_kind: 'launch_interest_only',
      source_state_version: sourceStateVersion,
      status: 'ok',
    });

    return res.status(200).json({
      status: 'ok',
      record,
      analytics_recorded: analyticsOutcome.valid,
      ui: {
        confirmation_message:
          'Ваш интерес к запуску «Личной главы» зафиксирован. Никаких списаний или обязательств это действие не создаёт.',
      },
    });
  } catch (err) {
    console.error('[ChapterOffer] Failed to record launch interest:', err);
    return res.status(500).json({
      status: 'error',
      code: 'launch_interest_failed',
      ui: {
        safe_message: 'Не удалось сохранить отметку об интересе к запуску. Попробуйте ещё раз.',
      },
    });
  }
}

export function installChapterOfferRoutes(app: Express): void {
  app.post('/api/chapter-sample/pdf', (req, res) => {
    void handleRenderChapterSamplePdf(req, res);
  });
  app.post('/api/launch-interest', (req, res) => {
    void handleRecordLaunchInterest(req, res);
  });
}

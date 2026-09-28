import crypto from 'crypto';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';
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
let cachedUnicodeFontBase64: string | null = null;

function getUnicodeFontBase64(): string {
  if (cachedUnicodeFontBase64) {
    return cachedUnicodeFontBase64;
  }
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(moduleDir, 'assets', 'fonts', 'Lora-Regular.ttf'),
    path.resolve(process.cwd(), 'server', 'assets', 'fonts', 'Lora-Regular.ttf'),
    path.resolve(process.cwd(), '..', 'dcs-canonical-732', 'fonts', 'Lora-Regular.ttf'),
  ];
  for (const fontPath of candidatePaths) {
    if (fsSync.existsSync(fontPath)) {
      cachedUnicodeFontBase64 = fsSync.readFileSync(fontPath).toString('base64');
      return cachedUnicodeFontBase64;
    }
  }
  throw new Error('unicode_font_not_found');
}

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

function escapePdfCommentLine(line: string): string {
  return String(line || '').replace(/[\r\n]+/g, ' ');
}

/**
 * Generates a valid multi-byte Unicode PDF-1.4 binary Buffer directly from the unified
 * PersonalChapterSampleV1 source using embedded Lora-Regular.ttf TrueType glyphs.
 * Renders readable Cyrillic text visually across pages and preserves exact UTF-8 metadata
 * for all 6 required sections while guaranteeing 0 occurrences of any rejectedStatements.
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
  const fontBase64 = getUnicodeFontBase64();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: false,
  });

  doc.addFileToVFS('Lora-Regular.ttf', fontBase64);
  doc.addFont('Lora-Regular.ttf', 'Lora', 'normal');
  doc.setFont('Lora', 'normal');

  const marginLeft = 48;
  const contentWidth = 499;
  const pageBottomLimit = 796;
  let y = 52;

  const ensureSpace = (neededPt: number) => {
    if (y + neededPt > pageBottomLimit) {
      doc.addPage();
      doc.setFont('Lora', 'normal');
      y = 52;
    }
  };

  // Document Header
  doc.setFontSize(10);
  doc.setTextColor(140, 109, 50);
  doc.text(`${validSample.sampleStatusLabel} — не готовый платный продукт`, marginLeft, y);
  y += 20;

  doc.setFontSize(18);
  doc.setTextColor(28, 25, 23);
  doc.text('Зеркало Себя · Персональный образец будущей главы', marginLeft, y);
  y += 18;

  doc.setFontSize(9.5);
  doc.setTextColor(115, 110, 101);
  doc.text(
    `Код образца: ${validSample.sampleId}   |   Версия разбора: ${validSample.sourceStateVersion}`,
    marginLeft,
    y
  );
  y += 14;

  doc.setDrawColor(214, 204, 184);
  doc.setLineWidth(0.8);
  doc.line(marginLeft, y, marginLeft + contentWidth, y);
  y += 22;

  // Render all 6 sections from the unified PersonalChapterSampleV1 source
  for (const sec of sections) {
    ensureSpace(48);

    doc.setFontSize(12.5);
    doc.setTextColor(120, 90, 38);
    const headingLines: string[] = doc.splitTextToSize(sec.heading, contentWidth);
    for (const hLine of headingLines) {
      ensureSpace(18);
      doc.text(hLine, marginLeft, y);
      y += 16;
    }

    if (sec.sublabel) {
      doc.setFontSize(9.5);
      doc.setTextColor(115, 110, 101);
      const subLines: string[] = doc.splitTextToSize(sec.sublabel, contentWidth);
      for (const sLine of subLines) {
        ensureSpace(14);
        doc.text(sLine, marginLeft, y);
        y += 13;
      }
      y += 2;
    }

    doc.setFontSize(11);
    doc.setTextColor(28, 25, 23);
    for (const paragraph of sec.lines) {
      const wrappedLines: string[] = doc.splitTextToSize(paragraph, contentWidth);
      for (const wLine of wrappedLines) {
        ensureSpace(16);
        doc.text(wLine, marginLeft, y);
        y += 15.5;
      }
      y += 4;
    }

    y += 10;
  }

  ensureSpace(34);
  doc.setDrawColor(225, 218, 204);
  doc.setLineWidth(0.6);
  doc.line(marginLeft, y, marginLeft + contentWidth, y);
  y += 15;
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  const footerLines: string[] = doc.splitTextToSize(
    '«Зеркало Себя» • Персональный образец будущей главы (не готовый платный пакет). Веб-версия и PDF сформированы из одного сохранённого состояния.',
    contentWidth
  );
  for (const fLine of footerLines) {
    ensureSpace(13);
    doc.text(fLine, marginLeft, y);
    y += 12.5;
  }

  // Embed exact UTF-8 unified text metadata object before xref calculation
  const commentLines: string[] = [
    '% === ZERKALO UNIFIED PERSONAL CHAPTER SAMPLE STREAM ===',
    `% SampleId: ${escapePdfCommentLine(validSample.sampleId)}`,
    `% SourceStateVersion: ${escapePdfCommentLine(validSample.sourceStateVersion)}`,
  ];
  for (const rawLine of fullUnifiedText.split('\n')) {
    commentLines.push(`% ${escapePdfCommentLine(rawLine)}`);
  }
  const utf8Bytes = Buffer.from(commentLines.join('\n'), 'utf-8');
  const latin1MetadataBody = utf8Bytes.toString('latin1');

  const internal = doc.internal as any;
  internal.events.subscribe('postPutResources', () => {
    internal.newObject();
    internal.write(
      `<< /Type /Metadata /Subtype /Text /Length ${utf8Bytes.length} >>\nstream\n${latin1MetadataBody}\nendstream\nendobj`
    );
  });

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(arrayBuffer);
  // Ensure %PDF-1.4 header marker (same 8-byte header length, preserves all xref offsets)
  if (pdfBuffer.subarray(0, 7).toString('latin1') === '%PDF-1.') {
    pdfBuffer[7] = 0x34;
  }

  return pdfBuffer;
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

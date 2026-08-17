import os
import re
import json

repo_root = '/Users/artemkrysin/Documents/Hermes_agent/zerkalo-lab'

target_files = [
    ('src/data/numberKnowledge.ts', 'Code / Archetypes', 'вы'),
    ('src/data/compoundKnowledge.ts', 'Code / Compounds', 'вы'),
    ('src/data/passportPractices.ts', 'Code / Practices', 'вы'),
    ('src/components/AlabasterSanctuary.tsx', 'Code UI', 'вы'),
    ('src/components/MeetingOfMirrors.tsx', 'Meeting UI', 'вы'),
    ('src/components/AlbertModal.tsx', 'Albert UI', 'вы'),
    ('src/components/AlbertDialogue.tsx', 'Albert UI', 'вы'),
    ('src/components/PersonalMyth.tsx', 'Myth UI', 'вы'),
    ('src/components/AboutMethod.tsx', 'About Method', 'вы'),
    ('src/components/MetaphorLibrary.tsx', 'Library', 'вы'),
    ('src/components/ArchetypeBasRelief.tsx', 'Archetypes', 'neutral'),
    ('src/services/interpretation.ts', 'Interpretation Engine', 'вы'),
    ('server/myth.ts', 'Myth Backend / Prompts', 'ты'),
    ('server/meeting.ts', 'Meeting Backend / Prompts', 'вы'),
    ('server/albert.ts', 'Albert Backend / Prompts', 'вы')
]

findings = []

ty_pattern = re.compile(r'\b(ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоих|твоем|твоём|твоему|твоей|твою)\b', re.IGNORECASE)
vy_pattern = re.compile(r'\b(вы|вас|вам|вами|ваш|ваша|ваше|ваши|ваших|вашем|вашему|вашей|вашу)\b', re.IGNORECASE)
forbidden_esoteric = re.compile(r'\b(карма|кармический|судьба неизбежна|исцеление|диагноз|лечение|магия|магический|высшие силы|предсказание)\b', re.IGNORECASE)

for rel_path, surface_name, intended_voice in target_files:
    full_path = os.path.join(repo_root, rel_path)
    if not os.path.exists(full_path):
        continue
        
    with open(full_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line_no, raw_line in enumerate(lines, 1):
        line = raw_line.strip()
        if not line or line.startswith('//') or line.startswith('/*') or line.startswith('*'):
            continue
            
        # Extract Russian string literals and JSX text
        cyrillic_matches = re.findall(r'["\'`]([^"\'`]*[\u0400-\u04FF][^"\'`]*)["\'`]|>([^<]*[\u0400-\u04FF][^<]*)<', line)
        
        for group in cyrillic_matches:
            for text in group:
                text = text.strip()
                if not text or len(text) < 4:
                    continue
                if 'http' in text or 'console.' in text or 'className' in text:
                    continue
                    
                # 1. Check Address Register Mismatches
                has_ty = bool(ty_pattern.search(text))
                has_vy = bool(vy_pattern.search(text))
                
                if intended_voice == 'вы' and has_ty and not has_vy:
                    # check if it's a quote or tale
                    if 'tale' not in line and 'quote' not in line and 'резонанс' not in line:
                        findings.append({
                            'id': f'FIND-{len(findings)+1:03d}',
                            'file': rel_path,
                            'line': line_no,
                            'surface': surface_name,
                            'type': 'REGISTER_INCONSISTENCY',
                            'severity': 'P1',
                            'description': f'Expected formal register «вы», but found informal «ты» pronoun.',
                            'rendered_phrase': text[:120],
                            'intended_voice': intended_voice,
                            'proposed_correction': 'Align to respectful formal «вы/ваш» register.'
                        })
                elif intended_voice == 'ты' and has_vy and not has_ty:
                    findings.append({
                        'id': f'FIND-{len(findings)+1:03d}',
                        'file': rel_path,
                        'line': line_no,
                        'surface': surface_name,
                        'type': 'REGISTER_INCONSISTENCY',
                        'severity': 'P1',
                        'description': f'Expected intimate register «ты», but found formal «вы» pronoun in Myth prompt/output.',
                        'rendered_phrase': text[:120],
                        'intended_voice': intended_voice,
                        'proposed_correction': 'Align to intimate poetic «ты/твой» second-person register.'
                    })
                    
                # 2. Check for Forbidden Esoteric / Deterministic Claims
                esoteric_match = forbidden_esoteric.search(text)
                if esoteric_match and 'FORBIDDEN' not in line and 'regex' not in line and 'not.toMatch' not in line and 'CRISIS' not in line:
                    findings.append({
                        'id': f'FIND-{len(findings)+1:03d}',
                        'file': rel_path,
                        'line': line_no,
                        'surface': surface_name,
                        'type': 'FORBIDDEN_VOCABULARY_OR_PREDICTION',
                        'severity': 'P1',
                        'description': f'Found esoteric/diagnostic vocabulary match: «{esoteric_match.group(0)}».',
                        'rendered_phrase': text[:120],
                        'intended_voice': intended_voice,
                        'proposed_correction': 'Replace with architectural/psychological/metaphorical terminology.'
                    })
                    
                # 3. Check for Suspicious Punctuation & Typo Patterns
                if '  ' in text and not '   ' in text:
                    findings.append({
                        'id': f'FIND-{len(findings)+1:03d}',
                        'file': rel_path,
                        'line': line_no,
                        'surface': surface_name,
                        'type': 'TYPOGRAPHY_DOUBLE_SPACE',
                        'severity': 'P2',
                        'description': 'Found double space in Russian text string.',
                        'rendered_phrase': text[:120],
                        'intended_voice': intended_voice,
                        'proposed_correction': 'Remove redundant space.'
                    })
                    
                if re.search(r'\b(TODO|FIXME|test|mock|fake|undefined|null)\b', text, re.IGNORECASE):
                    findings.append({
                        'id': f'FIND-{len(findings)+1:03d}',
                        'file': rel_path,
                        'line': line_no,
                        'surface': surface_name,
                        'type': 'DEV_PLACEHOLDER_LEAK',
                        'severity': 'P0',
                        'description': 'Potential development keyword/placeholder leaking into user string.',
                        'rendered_phrase': text[:120],
                        'intended_voice': intended_voice,
                        'proposed_correction': 'Replace with production copy.'
                    })

out_json_path = os.path.join(repo_root, 'docs/evidence/v1_1-audit/TEXT_QUALITY_FINDINGS.json')
os.makedirs(os.path.dirname(out_json_path), exist_ok=True)

with open(out_json_path, 'w', encoding='utf-8') as f:
    json.dump({
        'total_findings': len(findings),
        'voice_rules': {
            'personal_myth': 'ты/тебя (intimate, second-person singular)',
            'digital_code': 'вы/вас (respectful, architectural)',
            'meeting_of_mirrors': 'вы/вас (analytical synthesis)',
            'web_albert': 'вы/вас (intellectual guide, conversational)'
        },
        'findings': findings
    }, f, indent=2, ensure_ascii=False)

print(f'Full Copy Inventory Complete. Total findings: {len(findings)}')
print(f'Saved to: {out_json_path}')

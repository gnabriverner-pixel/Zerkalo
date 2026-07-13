import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProductTrustLayer } from './ProductTrustLayer';


describe('Digital Code release trust layer', () => {
  it('presents Albert transparently and links to the canonical Telegram bot', () => {
    const html = renderToStaticMarkup(<ProductTrustLayer />);

    expect(html).toContain('Альберт — цифровой проводник');
    expect(html).toContain('не вымышленный психолог');
    expect(html).toContain('35/8');
    expect(html).toContain('три коротких ответа');
    expect(html).toContain('https://t.me/digitalcodesystem_bot');
    expect(html).toContain('Разобрать мой вопрос');
  });

  it('keeps the public promise separate from the voluntary route', () => {
    const teaser = fs.readFileSync(path.resolve('src/components/BigResearchTeaser.tsx'), 'utf8');

    expect(teaser).toContain(
      'Разобрать один важный вопрос через полную цифровую формулу, понять происхождение внутреннего узла и увидеть конкретный следующий шаг.',
    );
    expect(teaser).toContain('Семидневную проверку можно начать отдельно, по желанию.');
  });

  it('keeps the route optional and exposes the privacy disclosure', () => {
    const html = renderToStaticMarkup(<ProductTrustLayer />);
    const privacy = fs.readFileSync(path.resolve('public/privacy.html'), 'utf8');

    expect(html).toContain('по желанию');
    expect(html).toContain('/privacy.html');
    expect(privacy).toContain('внешний провайдер языковой модели');
    expect(privacy).toContain('рабочими гипотезами для самонаблюдения');
    expect(privacy).not.toContain('Данные не передаются третьим лицам');
  });
});

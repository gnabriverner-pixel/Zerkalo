import {it,expect} from 'vitest';
import {generateFirstMirror,determineKeyInsight,methodReading} from './interpretation';
import {calculateDigitalCode} from './calculator';
import {buildMeetingOfMirrorsPrompt} from './mythPrompts';

it('all five positions influence the relational assembly without new calculation rules',()=>{
  const a=determineKeyInsight(1,2,3,4,5);
  expect(a).toContain('Душа 1');expect(a).toContain('Путь 2');expect(a).toContain('Результат 3');
  expect(a).toContain('Выражение 4');expect(a).toContain('Направление 5');
  expect(determineKeyInsight(1,2,3,6,7)).not.toBe(a);
});
it('calculated equality is not declared a proven unity of the person',()=>{
  const calc=calculateDigitalCode('11.11.2000');calc.expression=calc.soul;
  const r=generateFirstMirror(calc);
  expect(r.blocks.find(x=>x.id==='strength')!.text).toContain('не означает');
  expect(JSON.stringify(r)).not.toContain('Что уже является силой');
  expect(methodReading('Психика рассчитана на сверхнагрузки.')).not.toContain('Психика рассчитана');
});
it('Meeting explicitly distinguishes a machine cause from the actual user question',()=>{
  const calc=calculateDigitalCode('11.11.2000');
  const p=buildMeetingOfMirrorsPrompt({calc,firstMirror:generateFirstMirror(calc)}, {storyInputs:{q1:'Никакого внутреннего конфликта нет.',q2:'Стопка бумаг',q3:'Нашёл документ',q4:'Простоты'},storyResult:{title:'Листы',mirror:{}}});
  expect(p).toContain('Никакого внутреннего конфликта нет.');
  expect(p).toContain('не масштабируй её до психологической проблемы');
  expect(p).toContain('не устанавливают её скрытую причину');
});

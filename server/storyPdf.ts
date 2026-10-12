import {jsPDF} from 'jspdf';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {StoryOrder} from './commerceStore';

/** One serialization for HTML preview/tests/PDF. Model text and human text retain their authors. */
export function storySections(order:StoryOrder):{title:string;body:string}[]{
  const d=order.data,m=d.myth;
  if(!m)throw new Error('story_not_issued');
  return [
    {title:'Новая личная история',body:`${m.title}\n${order.test?'Тестовый экземпляр. ':''}История создана с помощью ИИ. Это образный взгляд, который можно принять, уточнить или отвергнуть.`},
    {title:'Ваши ответы',body:Object.entries(d.answers||{}).map(([key,value])=>`${({q1:'Ситуация',q2:'Образ состояния',q3:'Момент на своём месте',q4:'Желаемое качество'} as Record<string,string>)[key]||key}: ${value}`).join('\n\n')},
    ...(d.question?[{title:'Ваш вопрос Альберту',body:d.question}]:[]),
    {title:'Миф — текст истории',body:m.story},
    {title:'Зеркало — взгляд со стороны',body:Object.values(m.mirror||{}).join('\n\n')},
    {title:'Возможные смыслы',body:(m.meaning||[]).join('\n\n')},
    {title:'Предложение',body:[m.one_step,m.journal_question,m.disclaimer].filter(Boolean).join('\n\n')},
    ...d.messages.map(message=>({title:message.role==='user'?'Вы':'Альберт · проводник',body:message.content})),
    ...(d.note?[{title:'Ваша заметка',body:d.note}]:[]),
  ];
}
export function makeStoryPdf(order:StoryOrder):Buffer{
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const font=fs.readFileSync(fileURLToPath(new URL('./assets/fonts/Lora-Regular.ttf',import.meta.url))).toString('base64');
  doc.addFileToVFS('Lora.ttf',font);doc.addFont('Lora.ttf','Lora','normal');doc.setFont('Lora');
  doc.setProperties({title:order.data.myth?.title||'Новая личная история',author:'Зеркало себя'});
  let y=23;
  for(const section of storySections(order)){
    // Reserve a heading and at least two body lines to avoid an orphan heading/page.
    if(y>249){doc.addPage();y=23;}
    doc.setFontSize(15);doc.text(section.title,20,y);y+=10;doc.setFontSize(11);
    const lines=doc.splitTextToSize(String(section.body),170) as string[];
    for(const line of lines){if(y>270){doc.addPage();y=23;}doc.text(line,20,y);y+=6.5;}
    y+=8;
  }
  const count=doc.getNumberOfPages();
  for(let i=1;i<=count;i++){doc.setPage(i);doc.setFontSize(9);doc.text(`${i} / ${count}`,190,286,{align:'right'});}
  return Buffer.from(doc.output('arraybuffer'));
}

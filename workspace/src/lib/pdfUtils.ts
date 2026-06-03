import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const saveElementAsPdf = async (element: HTMLElement | null, filename: string = 'DigitalCode.pdf') => {
  if (!element) return;
  
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#F8F5EF' // marble bg color fallback
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    
    // If output is very long, might need multiple pages, but scaling to 1 page is easier first.
    // Or we can just calculate height:
    const finalImgWidth = imgWidth * ratio;
    const finalImgHeight = imgHeight * ratio;

    let heightLeft = finalImgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', (pdfWidth - finalImgWidth) / 2, position, finalImgWidth, finalImgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft >= 0) {
      position = heightLeft - finalImgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', (pdfWidth - finalImgWidth) / 2, position, finalImgWidth, finalImgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Failed to generate PDF', error);
  }
};

//helpers/uploadProductFiles.js
import supabase from '../supabaseClient';  // Caminho para o seu arquivo de configuração do Supabase
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function uploadProductFiles(productId, files) {
  const { image, video, pdf } = files;

  let imageUrl = null, videoUrl = null, pdfUrl = null;

  // Upload da imagem
  if (image) {
    const { data, error: imageError } = await supabase.storage
      .from('product-images')
      .upload(`image/${productId}-${image.name}`, image);
    if (!imageError) {
      imageUrl = supabase.storage.from('product-images').getPublicUrl(`image/${productId}-${image.name}`).publicURL;
    }
  }

  // Upload do vídeo
  if (video) {
    const { data, error: videoError } = await supabase.storage
      .from('product-videos')
      .upload(`video/${productId}-${video.name}`, video);
    if (!videoError) {
      videoUrl = supabase.storage.from('product-videos').getPublicUrl(`video/${productId}-${video.name}`).publicURL;
    }
  }

  // Upload do PDF
  if (pdf) {
    const { data, error: pdfError } = await supabase.storage
      .from('product-pdfs')
      .upload(`pdf/${productId}-${pdf.name}`, pdf);
    if (!pdfError) {
      pdfUrl = supabase.storage.from('product-pdfs').getPublicUrl(`pdf/${productId}-${pdf.name}`).publicURL;
    }
  }

  // Atualiza o produto com os links dos arquivos
  await prisma.product.update({
    where: { id: productId },
    data: {
      imageUrl: imageUrl,
      videoUrl: videoUrl,
      pdfUrl: pdfUrl,
    },
  });
}

export default uploadProductFiles;

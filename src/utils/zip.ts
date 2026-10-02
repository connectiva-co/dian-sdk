import JSZip from 'jszip';
import { DianError } from '../errors/DianError.js';

/**
 * Compresses an XML document string or Buffer into a ZIP file and returns its Base64 string
 */
export async function createZipPackage(xmlContent: string | Buffer, fileNameInZip: string): Promise<string> {
  const zip = new JSZip();
  zip.file(fileNameInZip, xmlContent);
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  return buffer.toString('base64');
}

export interface ExtractedXmlDocument {
  fileName: string;
  xml: string;
}

/**
 * Decompresses a Base64-encoded ZIP file returned by DIAN (XmlBase64Bytes) and extracts the XML documents
 */
export async function extractZipDocuments(zipBase64: string): Promise<ExtractedXmlDocument[]> {
  try {
    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);
    const documents: ExtractedXmlDocument[] = [];

    const fileEntries = Object.entries(zip.files);
    for (const [fileName, file] of fileEntries) {
      if (!file.dir && fileName.toLowerCase().endsWith('.xml')) {
        const xml = await file.async('string');
        documents.push({ fileName, xml });
      }
    }

    if (documents.length === 0) {
      // If no .xml extension found, try extracting any first non-dir file
      for (const [fileName, file] of fileEntries) {
        if (!file.dir) {
          const content = await file.async('string');
          if (content.trim().startsWith('<')) {
            documents.push({ fileName, xml: content });
          }
        }
      }
    }

    return documents;
  } catch (err: unknown) {
    throw new DianError(`Failed to decompress ZIP package from DIAN: ${(err as Error)?.message || String(err)}`);
  }
}

/**
 * Extracts the primary ApplicationResponse or AttachedDocument XML from DIAN's XmlBase64Bytes
 */
export async function extractApplicationResponse(zipBase64: string): Promise<string | undefined> {
  const docs = await extractZipDocuments(zipBase64);
  // Look for ApplicationResponse or first xml
  const appResponse = docs.find((d) => d.xml.includes('ApplicationResponse')) || docs[0];
  return appResponse?.xml;
}

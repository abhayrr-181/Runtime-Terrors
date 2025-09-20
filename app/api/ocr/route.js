import { NextResponse } from "next/server";
import Tesseract from 'tesseract.js';

export async function POST(req) {
  try {
    const body = await req.json();
    const { imageData } = body;
    
    if (!imageData) {
      return NextResponse.json({ 
        success: false, 
        error: 'No image data provided' 
      });
    }

    // Extract text using Tesseract.js
    const { data: { text } } = await Tesseract.recognize(
      imageData,
      'eng',
      {
        logger: m => console.log(m)
      }
    );

    return NextResponse.json({ 
      success: true, 
      text: text.trim(),
      confidence: 0.8 // Placeholder confidence
    });
  } catch (e) {
    console.error('OCR error:', e);
    return NextResponse.json({ 
      success: false, 
      error: 'OCR processing failed: ' + e.message 
    }, { status: 500 });
  }
}

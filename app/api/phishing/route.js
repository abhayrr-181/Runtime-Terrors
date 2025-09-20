import { NextResponse } from "next/server";

const HF_API = process.env.HUGGINGFACE_API_KEY;
const PHISH_MODEL = process.env.HF_PHISH_MODEL || 'r3ddkahili/final-complete-malicious-url-model';

export async function POST(req) {
  try {
    const body = await req.json();
    const { url, email, message, screenshot } = body;
    
    // Handle URL detection
    if (url) {
      return await detectUrlPhishing(url);
    }
    
    // Handle email detection
    if (email) {
      return await detectEmailPhishing(email);
    }
    
    // Handle message detection
    if (message) {
      return await detectMessagePhishing(message);
    }
    
    // Handle screenshot detection
    if (screenshot) {
      return await detectScreenshotPhishing(screenshot);
    }
    
    return NextResponse.json({ 
      label: 'Invalid', 
      confidence: 0, 
      details: ['No input provided. Please provide URL, email, message, or screenshot.'] 
    });
  } catch (e) {
    console.error('Phishing detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Internal error: ' + e.message] 
    }, { status: 500 });
  }
}

async function detectUrlPhishing(url) {
  if (!url) {
    return NextResponse.json({ label: 'Invalid', confidence: 0, details: ['No URL provided'] });
  }

  // Check if API key is available
  if (!HF_API || HF_API === 'your_huggingface_api_key_here') {
    return await fallbackUrlDetection(url);
  }

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${PHISH_MODEL}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${HF_API}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        inputs: url, 
        options: { wait_for_model: true } 
      })
    });

    if (!res.ok) {
      return NextResponse.json({
        label: 'API Error',
        confidence: 0,
        summary: `Hugging Face API error: ${res.status} ${res.statusText}`,
        details: ['Please check your API key and try again.']
      });
    }

    const text = await res.text();
    let parsed = null;
    
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({
        label: 'Parse Error',
        confidence: 0,
        summary: `Model did not return valid JSON. Raw response: ${text.substring(0, 200)}...`,
        details: ['The model response could not be parsed. This might be a temporary issue.']
      });
    }

    let label = 'Unknown';
    let confidence = 0;

    if (Array.isArray(parsed) && parsed[0]?.label) {
      label = parsed[0].label;
      confidence = parsed[0].score ?? 0;
    } else if (Array.isArray(parsed) && parsed[0]?.[0]?.label) {
      label = parsed[0][0].label;
      confidence = parsed[0][0].score ?? 0;
    } else if (parsed?.label) {
      label = parsed.label;
      confidence = parsed.score ?? 0;
    } else {
      // Fallback to rule-based detection if API fails
      return await fallbackUrlDetection(url);
    }

    const unsafe = ['phishing', 'malware', 'defacement', 'squatting'];
    const verdict = unsafe.includes(label.toLowerCase()) ? 'Unsafe' : 'Safe';
    const summary = verdict === 'Unsafe'
      ? `Model predicts ${label} with ${(confidence*100).toFixed(1)}% confidence.`
      : `Model predicts the URL is likely benign (${(confidence*100).toFixed(1)}% confidence).`;

    const details = [
      `Raw model label: ${label}`,
      `Model confidence: ${(confidence*100).toFixed(2)}%`
    ];

    // Additional URL analysis
    try {
      const u = new URL(url);
      if ((u.hostname.match(/\./g) || []).length >= 4) details.push('Multiple subdomains detected.');
      if (u.hostname.includes('-')) details.push('Hyphens in host name.');
      if (url.length > 90) details.push('Long URL length.');
      if (u.protocol !== 'https:') details.push('Not using HTTPS protocol.');
    } catch {}

    return NextResponse.json({ 
      label: `${verdict} (${label})`, 
      confidence, 
      summary, 
      details,
      type: 'url'
    });
  } catch (e) {
    console.error('URL detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['URL detection failed: ' + e.message] 
    });
  }
}

async function detectEmailPhishing(email) {
  if (!email) {
    return NextResponse.json({ label: 'Invalid', confidence: 0, details: ['No email provided'] });
  }

  try {
    // Basic email phishing detection using pattern matching
    const suspiciousPatterns = [
      { pattern: /urgent|immediate|act now|limited time/i, weight: 0.3 },
      { pattern: /click here|verify account|update information/i, weight: 0.4 },
      { pattern: /suspended|locked|expired|terminated/i, weight: 0.3 },
      { pattern: /free money|win|prize|lottery/i, weight: 0.5 },
      { pattern: /bank|paypal|amazon|apple|microsoft/i, weight: 0.2 },
      { pattern: /http[s]?:\/\/[^\s]+/i, weight: 0.3 },
      { pattern: /[^\s]+@[^\s]+\.[^\s]+/i, weight: 0.1 }
    ];

    let totalScore = 0;
    const matchedPatterns = [];

    for (const { pattern, weight } of suspiciousPatterns) {
      if (pattern.test(email)) {
        totalScore += weight;
        matchedPatterns.push(pattern.source);
      }
    }

    // Check for suspicious domains
    const domainMatch = email.match(/@([^\s]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].toLowerCase();
      const suspiciousDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
      if (suspiciousDomains.some(d => domain.includes(d))) {
        totalScore += 0.1;
        matchedPatterns.push('Suspicious domain');
      }
    }

    const confidence = Math.min(totalScore, 1);
    const verdict = confidence > 0.5 ? 'Unsafe' : 'Safe';
    
    const summary = verdict === 'Unsafe'
      ? `Email contains ${matchedPatterns.length} suspicious patterns with ${(confidence*100).toFixed(1)}% confidence.`
      : `Email appears legitimate with ${(confidence*100).toFixed(1)}% confidence.`;

    const details = [
      `Suspicious patterns detected: ${matchedPatterns.length}`,
      `Matched patterns: ${matchedPatterns.join(', ')}`,
      `Confidence score: ${(confidence*100).toFixed(2)}%`
    ];

    return NextResponse.json({ 
      label: `${verdict} (Email)`, 
      confidence, 
      summary, 
      details,
      type: 'email'
    });
  } catch (e) {
    console.error('Email detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Email detection failed: ' + e.message] 
    });
  }
}

async function detectMessagePhishing(message) {
  if (!message) {
    return NextResponse.json({ label: 'Invalid', confidence: 0, details: ['No message provided'] });
  }

  try {
    // Similar pattern matching for text messages
    const suspiciousPatterns = [
      { pattern: /urgent|immediate|act now|limited time/i, weight: 0.3 },
      { pattern: /click here|verify|update|confirm/i, weight: 0.4 },
      { pattern: /suspended|locked|expired|terminated/i, weight: 0.3 },
      { pattern: /free money|win|prize|lottery|congratulations/i, weight: 0.5 },
      { pattern: /bank|paypal|amazon|apple|microsoft|google/i, weight: 0.2 },
      { pattern: /http[s]?:\/\/[^\s]+/i, weight: 0.4 },
      { pattern: /call now|text back|reply stop/i, weight: 0.3 }
    ];

    let totalScore = 0;
    const matchedPatterns = [];

    for (const { pattern, weight } of suspiciousPatterns) {
      if (pattern.test(message)) {
        totalScore += weight;
        matchedPatterns.push(pattern.source);
      }
    }

    const confidence = Math.min(totalScore, 1);
    const verdict = confidence > 0.5 ? 'Unsafe' : 'Safe';
    
    const summary = verdict === 'Unsafe'
      ? `Message contains ${matchedPatterns.length} suspicious patterns with ${(confidence*100).toFixed(1)}% confidence.`
      : `Message appears legitimate with ${(confidence*100).toFixed(1)}% confidence.`;

    const details = [
      `Suspicious patterns detected: ${matchedPatterns.length}`,
      `Matched patterns: ${matchedPatterns.join(', ')}`,
      `Confidence score: ${(confidence*100).toFixed(2)}%`
    ];

    return NextResponse.json({ 
      label: `${verdict} (Message)`, 
      confidence, 
      summary, 
      details,
      type: 'message'
    });
  } catch (e) {
    console.error('Message detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Message detection failed: ' + e.message] 
    });
  }
}

async function detectScreenshotPhishing(screenshot) {
  if (!screenshot) {
    return NextResponse.json({ label: 'Invalid', confidence: 0, details: ['No screenshot provided'] });
  }

  try {
    // Extract text from screenshot using basic pattern matching
    // In a production environment, you would use Tesseract.js for OCR
    const extractedText = await extractTextFromImage(screenshot);
    
    if (!extractedText) {
      return NextResponse.json({ 
        label: 'No Text Detected', 
        confidence: 0, 
        summary: 'No readable text found in the screenshot.',
        details: ['Please ensure the screenshot contains clear, readable text.'],
        type: 'screenshot'
      });
    }

    // Analyze the extracted text for phishing patterns
    const suspiciousPatterns = [
      { pattern: /urgent|immediate|act now|limited time/i, weight: 0.3 },
      { pattern: /click here|verify|update|confirm|login/i, weight: 0.4 },
      { pattern: /suspended|locked|expired|terminated|security/i, weight: 0.3 },
      { pattern: /free money|win|prize|lottery|congratulations/i, weight: 0.5 },
      { pattern: /bank|paypal|amazon|apple|microsoft|google|facebook/i, weight: 0.2 },
      { pattern: /http[s]?:\/\/[^\s]+/i, weight: 0.4 },
      { pattern: /call now|text back|reply stop|unsubscribe/i, weight: 0.3 },
      { pattern: /password|account|login|sign in/i, weight: 0.3 }
    ];

    let totalScore = 0;
    const matchedPatterns = [];

    for (const { pattern, weight } of suspiciousPatterns) {
      if (pattern.test(extractedText)) {
        totalScore += weight;
        matchedPatterns.push(pattern.source);
      }
    }

    // Check for suspicious URLs in the text
    const urlMatches = extractedText.match(/https?:\/\/[^\s]+/g);
    if (urlMatches) {
      for (const url of urlMatches) {
        try {
          const u = new URL(url);
          if (u.hostname.includes('-')) totalScore += 0.1;
          if (u.hostname.split('.').length > 3) totalScore += 0.1;
          if (url.length > 80) totalScore += 0.1;
        } catch {}
      }
    }

    const confidence = Math.min(totalScore, 1);
    const verdict = confidence > 0.5 ? 'Unsafe' : 'Safe';
    
    const summary = verdict === 'Unsafe'
      ? `Screenshot contains ${matchedPatterns.length} suspicious patterns with ${(confidence*100).toFixed(1)}% confidence.`
      : `Screenshot appears legitimate with ${(confidence*100).toFixed(1)}% confidence.`;

    const details = [
      `Text extracted: ${extractedText.length} characters`,
      `Suspicious patterns detected: ${matchedPatterns.length}`,
      `Matched patterns: ${matchedPatterns.slice(0, 3).join(', ')}${matchedPatterns.length > 3 ? '...' : ''}`,
      `Confidence score: ${(confidence*100).toFixed(2)}%`
    ];

    if (urlMatches && urlMatches.length > 0) {
      details.push(`URLs found: ${urlMatches.length}`);
    }

    return NextResponse.json({ 
      label: `${verdict} (Screenshot)`, 
      confidence, 
      summary, 
      details,
      type: 'screenshot',
      extractedText: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '')
    });
  } catch (e) {
    console.error('Screenshot detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Screenshot detection failed: ' + e.message] 
    });
  }
}

async function fallbackUrlDetection(url) {
  try {
    // Add protocol if missing
    let testUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      testUrl = 'https://' + url;
    }
    
    const u = new URL(testUrl);
    let score = 0;
    const details = [];
    
    // Check for suspicious patterns
    if (u.hostname.includes('-')) {
      score += 0.2;
      details.push('Hyphens in hostname');
    }
    
    if ((u.hostname.match(/\./g) || []).length >= 4) {
      score += 0.3;
      details.push('Multiple subdomains detected');
    }
    
    if (url.length > 90) {
      score += 0.2;
      details.push('Long URL length');
    }
    
    if (u.protocol !== 'https:') {
      score += 0.3;
      details.push('Not using HTTPS protocol');
    }
    
    // Check for typosquatting
    const suspiciousDomains = ['g0ogle', 'go0gle', 'g00gle', 'faceb00k', 'amaz0n', 'paypa1', 'micr0soft', 'app1e', 'y0utube'];
    if (suspiciousDomains.some(domain => u.hostname.includes(domain))) {
      score += 0.5;
      details.push('Potential typosquatting detected');
    }
    
    // Check for suspicious TLDs
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.click', '.download'];
    if (suspiciousTlds.some(tld => u.hostname.endsWith(tld))) {
      score += 0.4;
      details.push('Suspicious top-level domain');
    }
    
    // Check for IP addresses
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(u.hostname)) {
      score += 0.4;
      details.push('Uses IP address instead of domain name');
    }
    
    // Check for shortened URLs
    const shorteners = ['bit.ly', 'tinyurl.com', 'short.link', 't.co', 'goo.gl'];
    if (shorteners.some(shortener => u.hostname.includes(shortener))) {
      score += 0.3;
      details.push('Shortened URL detected');
    }
    
    // Check for suspicious keywords in path
    const suspiciousKeywords = ['login', 'verify', 'account', 'security', 'update', 'confirm'];
    if (suspiciousKeywords.some(keyword => u.pathname.toLowerCase().includes(keyword))) {
      score += 0.2;
      details.push('Suspicious keywords in URL path');
    }
    
    const confidence = Math.min(score, 1);
    const verdict = confidence > 0.5 ? 'Unsafe' : 'Safe';
    
    const summary = verdict === 'Unsafe'
      ? `Rule-based analysis detected ${details.length} suspicious indicators with ${(confidence*100).toFixed(1)}% confidence.`
      : `Rule-based analysis suggests the URL is likely safe (${(confidence*100).toFixed(1)}% confidence).`;
    
    return NextResponse.json({ 
      label: `${verdict} (Rule-based)`, 
      confidence, 
      summary, 
      details,
      type: 'url'
    });
  } catch (e) {
    return NextResponse.json({ 
      label: 'Invalid URL', 
      confidence: 0, 
      summary: 'The provided URL is not valid.',
      details: ['Please check the URL format and try again.'],
      type: 'url'
    });
  }
}

async function extractTextFromImage(imageData) {
  try {
    // Use the OCR API to extract text from the image
    const ocrResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });

    if (!ocrResponse.ok) {
      throw new Error('OCR API failed');
    }

    const ocrResult = await ocrResponse.json();
    
    if (ocrResult.success) {
      return ocrResult.text;
    } else {
      throw new Error(ocrResult.error || 'OCR failed');
    }
  } catch (e) {
    console.error('Text extraction error:', e);
    // Fallback: return a message indicating OCR is not available
    return 'OCR service temporarily unavailable. Please use URL, Email, or Message detection instead.';
  }
}

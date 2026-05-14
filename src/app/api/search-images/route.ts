import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Falta el término de búsqueda (query)' }, { status: 400 });
    }

    // Simplify the query - remove measurements for better results but keep brand
    const cleanQuery = query
      .replace(/\([^)]*\)/g, '') // Remove parenthetical content like (.020), (STD)
      .replace(/\s+/g, ' ')
      .trim();

    const searchTerm = `${cleanQuery} repuesto automotriz`;

    // Try multiple search strategies
    const images = await tryBingImages(searchTerm) 
      || await tryDuckDuckGo(searchTerm) 
      || await tryGoogleThis(query);

    if (images && images.length > 0) {
      // Shuffle for variety on each search
      for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]];
      }
      return NextResponse.json({ images: images.slice(0, 20) });
    }

    return NextResponse.json({ images: [], message: 'No se encontraron imágenes.' });
  } catch (error: any) {
    console.error('Error searching images:', error?.message || error);
    return NextResponse.json({ error: 'Error al buscar imágenes.' }, { status: 500 });
  }
}

// Strategy 1: Bing Image Search (most reliable scraping)
async function tryBingImages(query: string): Promise<string[] | null> {
  try {
    const encoded = encodeURIComponent(query);
    const randomOffset = Math.floor(Math.random() * 60) + 1; // Random page start for variety
    const res = await fetch(`https://www.bing.com/images/search?q=${encoded}&first=${randomOffset}&count=30&qft=+filterui:photo-photo`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    
    // Extract image URLs from Bing's data attributes
    const urls: string[] = [];
    
    // Pattern 1: murl from metadata
    const murlRegex = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;
    let match;
    while ((match = murlRegex.exec(html)) !== null && urls.length < 20) {
      const url = match[1].replace(/&amp;/g, '&');
      if (isValidImageUrl(url)) {
        urls.push(url);
      }
    }

    // Pattern 2: src= in image tags  
    if (urls.length < 3) {
      const srcRegex = /src2?="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
      while ((match = srcRegex.exec(html)) !== null && urls.length < 20) {
        const url = match[1].replace(/&amp;/g, '&');
        if (isValidImageUrl(url) && !urls.includes(url)) {
          urls.push(url);
        }
      }
    }

    return urls.length > 0 ? urls : null;
  } catch (e) {
    console.error('Bing search failed:', e);
    return null;
  }
}

// Strategy 2: DuckDuckGo 
async function tryDuckDuckGo(query: string): Promise<string[] | null> {
  try {
    const encoded = encodeURIComponent(query);
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
    });

    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) return null;

    const imageRes = await fetch(
      `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encoded}&vqd=${vqdMatch[1]}&f=,,,,,&p=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Referer': 'https://duckduckgo.com/',
        },
      }
    );

    const data = await imageRes.json();
    const images = (data.results || [])
      .slice(0, 20)
      .map((r: any) => r.image)
      .filter((url: string) => isValidImageUrl(url));

    return images.length > 0 ? images : null;
  } catch (e) {
    console.error('DuckDuckGo search failed:', e);
    return null;
  }
}

// Strategy 3: googlethis fallback
async function tryGoogleThis(query: string): Promise<string[] | null> {
  try {
    const google = (await import('googlethis')).default;
    const response = await google.image(`${query} repuesto`, { safe: false });
    const images = response
      .slice(0, 20)
      .map((img: any) => img.url)
      .filter((url: string) => isValidImageUrl(url));
    return images.length > 0 ? images : null;
  } catch (e) {
    console.error('GoogleThis search failed:', e);
    return null;
  }
}

function isValidImageUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  // Filter out tiny tracking pixels and icons
  if (url.includes('1x1') || url.includes('pixel') || url.includes('favicon')) return false;
  return true;
}

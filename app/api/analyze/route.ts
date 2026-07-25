import { NextRequest, NextResponse } from 'next/server';
import { parseCsv } from '@/lib/csv';
import { analyzeWiringData, summarizeIssues, MODEL } from '@/lib/analyze';
import type { AnalyzeProgressEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

function encode(obj: unknown): string {
  return JSON.stringify(obj) + '\n';
}

/**
 * POST /api/analyze
 *
 * Receives a CSV file, parses it, and sends the structured rows to the Groq
 * API for AI-powered data-quality auditing. Progress is streamed back to the
 * client as newline-delimited JSON (NDJSON) so the UI can show per-chunk
 * progress. The final event is the complete AnalyzeResponse.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let csvText: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'No CSV file provided.' },
          { status: 400 }
        );
      }
      csvText = await file.text();
    } else {
      csvText = await req.text();
    }

    if (!csvText || csvText.trim() === '') {
      return NextResponse.json(
        { error: 'CSV content is empty.' },
        { status: 400 }
      );
    }

    const parsed = parseCsv(csvText);
    if (parsed.rowCount === 0) {
      return NextResponse.json(
        { error: 'No data rows found in the CSV.' },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const { issues, chunked } = await analyzeWiringData(
            parsed.headers,
            parsed.rows,
            parsed.headerRowNumber,
            {
              onProgress: (p) => {
                const event: AnalyzeProgressEvent = p;
                controller.enqueue(encoder.encode(encode({ type: 'progress', ...event })));
              },
            }
          );

          controller.enqueue(
            encoder.encode(encode({ type: 'progress', phase: 'summarizing', done: 0, total: 1, startRow: 0, endRow: 0 }))
          );

          let aiSummary = '';
          try {
            aiSummary = await summarizeIssues(issues, parsed.rowCount);
          } catch {
            aiSummary = '## Summary unavailable\n\nThe AI summary could not be generated, but the full findings table below is still available.';
          }

          const final = {
            type: 'result',
            issues,
            aiSummary,
            meta: {
              rowsAnalyzed: parsed.rowCount,
              analyzedAt: new Date().toISOString(),
              model: MODEL,
              chunked,
            },
          };
          controller.enqueue(encoder.encode(encode(final)));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(encoder.encode(encode({ type: 'error', error: message })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('GROQ_API_KEY') ? 503 : 500;
    return NextResponse.json({ error: `Failed to analyze CSV: ${message}` }, { status });
  }
}

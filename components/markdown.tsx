'use client';

import { Fragment } from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'code'; text: string };

function parseInline(text: string): (string)[] {
  return [text];
}

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let list: string[] | null = null;
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (list && listType) {
      blocks.push({ type: listType, items: list });
      list = null;
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushList();
      continue;
    }

    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const ulMatch = line.match(/^[-*]\s+(.*)/);
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    const codeMatch = line.match(/^```/);

    if (h2) {
      flushList();
      blocks.push({ type: 'h2', text: h2[1].trim() });
    } else if (h3) {
      flushList();
      blocks.push({ type: 'h3', text: h3[1].trim() });
    } else if (h1) {
      flushList();
      blocks.push({ type: 'h1', text: h1[1].trim() });
    } else if (ulMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      if (!list) list = [];
      list.push(ulMatch[1].trim());
    } else if (olMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      if (!list) list = [];
      list.push(olMatch[1].trim());
    } else if (codeMatch) {
      flushList();
      blocks.push({ type: 'code', text: '' });
    } else {
      flushList();
      blocks.push({ type: 'p', text: line.trim() });
    }
  }
  flushList();

  return blocks;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ content, className }: MarkdownProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h1':
            return (
              <h2 key={i} className="mt-5 text-lg font-semibold text-foreground first:mt-0">
                {renderInline(block.text)}
              </h2>
            );
          case 'h2':
            return (
              <h3 key={i} className="mt-5 text-base font-semibold text-foreground first:mt-0">
                {renderInline(block.text)}
              </h3>
            );
          case 'h3':
            return (
              <h4 key={i} className="mt-4 text-sm font-semibold text-foreground first:mt-0">
                {renderInline(block.text)}
              </h4>
            );
          case 'p':
            return (
              <p key={i} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {renderInline(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="mt-2 space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j} className="text-sm leading-relaxed text-muted-foreground list-disc">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="mt-2 space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j} className="text-sm leading-relaxed text-muted-foreground list-decimal">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );
          case 'code':
            return null;
          default:
            return null;
        }
      })}
    </div>
  );
}

import React from 'react';

/**
 * Simple markdown renderer for chat messages
 * Supports: **bold**, *italic*, `code`, ```code blocks```, lists, line breaks
 */
export const renderMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;

  // Split by code blocks first (they have highest priority)
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // Process code blocks first
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      parts.push(...processText(beforeText, key));
      key += beforeText.length;
    }

    // Add code block
    parts.push(
      <pre key={`codeblock-${key++}`} className="bg-gray-800 text-gray-100 p-3 rounded-lg my-2 overflow-x-auto text-xs font-mono whitespace-pre">
        <code>{match[1].trim()}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    parts.push(...processText(remainingText, key));
  }

  return parts.length > 0 ? <>{parts}</> : text;
};

/**
 * Process text with inline formatting (bold, italic, code)
 */
const processText = (text: string, baseKey: number): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = baseKey;

  // Find all inline code, bold, and italic matches
  // Process in order: code blocks (already done), inline code, bold, italic
  const inlineCodeRegex = /`([^`\n]+)`/g;
  const boldRegex = /\*\*([^*]+?)\*\*/g; // Non-greedy match
  const boldUnderscoreRegex = /__([^_]+?)__/g;
  const italicRegex = /(?:\*([^*\n]+?)\*(?!\*))/g; // Match single * but not **
  const italicUnderscoreRegex = /(?:_([^_\n]+?)_(?!_))/g; // Match single _ but not __

  const matches: Array<{ start: number; end: number; type: string; content: string }> = [];

  // Collect all matches
  [inlineCodeRegex, boldRegex, boldUnderscoreRegex, italicRegex, italicUnderscoreRegex].forEach((regex, index) => {
    const types = ['inlineCode', 'bold', 'bold', 'italic', 'italic'];
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: types[index],
        content: match[1],
      });
    }
  });

  // Sort by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep earlier ones)
  const filteredMatches: typeof matches = [];
  matches.forEach((match) => {
    const overlaps = filteredMatches.some(
      (existing) =>
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end) ||
        (match.start <= existing.start && match.end >= existing.end)
    );
    if (!overlaps) {
      filteredMatches.push(match);
    }
  });

  // Process matches
  filteredMatches.forEach((match) => {
    // Add text before match
    if (match.start > currentIndex) {
      const beforeText = text.substring(currentIndex, match.start);
      parts.push(...processLineBreaks(beforeText, key));
      key += beforeText.length;
    }

    // Add formatted match
    switch (match.type) {
      case 'inlineCode':
        parts.push(
          <code key={`code-${key++}`} className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
            {match.content}
          </code>
        );
        break;
      case 'bold':
        parts.push(
          <strong key={`bold-${key++}`} className="font-semibold">
            {match.content}
          </strong>
        );
        break;
      case 'italic':
        parts.push(
          <em key={`italic-${key++}`} className="italic">
            {match.content}
          </em>
        );
        break;
    }

    currentIndex = match.end;
  });

  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    parts.push(...processLineBreaks(remainingText, key));
  }

  return parts;
};

/**
 * Process line breaks and lists
 */
const processLineBreaks = (text: string, baseKey: number): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const lines = text.split('\n');
  let key = baseKey;

  lines.forEach((line, index) => {
    if (index > 0) {
      parts.push(<br key={`br-${key++}`} />);
    }

    if (line.trim()) {
      // Check for list items
      const listMatch = line.match(/^[-*+]\s+(.+)$/);
      if (listMatch) {
        parts.push(
          <span key={`list-${key++}`} className="block">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-600 mr-2"></span>
            {listMatch[1]}
          </span>
        );
      } else {
        parts.push(line);
      }
    }
  });

  return parts;
};


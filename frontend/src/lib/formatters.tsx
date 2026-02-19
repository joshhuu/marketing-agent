/**
 * Utility functions for formatting text content
 */

/**
 * Parse markdown-style bold text (**text**) and convert to React elements
 * @param text - The text containing **bold** markers
 * @returns JSX with bold formatting applied
 */
export function parseMarkdownBold(text: string): (string | JSX.Element)[] {
  if (!text) return [text];
  
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add bold text
    parts.push(
      <strong key={`bold-${key++}`} className="font-bold text-foreground">
        {match[1]}
      </strong>
    );
    
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

/**
 * Component to render text with markdown bold support
 */
interface FormattedTextProps {
  children: string;
  className?: string;
}

export function FormattedText({ children, className = '' }: FormattedTextProps): JSX.Element {
  const formatted = parseMarkdownBold(children);
  
  return (
    <span className={className}>
      {formatted}
    </span>
  );
}

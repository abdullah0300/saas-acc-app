import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Type
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'mb-4',
          },
        },
        // Ensure lists are enabled
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-5',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-5',
          },
        },
      }),
      TextStyle,
      FontSize,
      Image,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      // Get HTML and ensure proper formatting
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  });

  // Handle paste events directly on the editor
  React.useEffect(() => {
    if (!editor) return;

    // Get the editor's DOM element
    const editorElement = editor.view.dom as HTMLElement;
    if (!editorElement) return;

    const handlePaste = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      // Try to get HTML content first
      const html = clipboardData.getData('text/html');
      const plainText = clipboardData.getData('text/plain');

      console.log('Paste event:', { hasHtml: !!html, hasPlainText: !!plainText, htmlLength: html?.length });

      // If we have HTML, process it
      if (html && html.trim().length > 0) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Clean and normalize HTML from external sources
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Preserve font sizes - extract from style and convert to data attributes
        tempDiv.querySelectorAll('*').forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          const style = htmlEl.getAttribute('style');
          
          // Extract font-size from style
          if (style && style.includes('font-size')) {
            const fontSizeMatch = style.match(/font-size:\s*([^;]+)/i);
            if (fontSizeMatch) {
              let fontSize = fontSizeMatch[1].trim();
              // Convert various formats to px
              if (fontSize.includes('pt')) {
                fontSize = (parseFloat(fontSize) * 1.33).toFixed(0) + 'px';
              } else if (fontSize.includes('em')) {
                fontSize = (parseFloat(fontSize) * 16).toFixed(0) + 'px';
              } else if (!fontSize.includes('px')) {
                fontSize = fontSize + 'px';
              }
              // Keep font-size in style for now (TipTap will parse it)
              htmlEl.setAttribute('style', `font-size: ${fontSize};`);
            }
          }
          
          // Remove unwanted attributes but keep style (for font-size)
          const keepStyle = htmlEl.getAttribute('style') || '';
          htmlEl.removeAttribute('class');
          htmlEl.removeAttribute('id');
          
          // Keep style only if it has font-size
          if (!keepStyle.includes('font-size')) {
            htmlEl.removeAttribute('style');
          }
        });

        // Get cleaned HTML
        let cleaned = tempDiv.innerHTML;

        // Convert <b> to <strong>
        cleaned = cleaned.replace(/<b(\s[^>]*)?>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');
        
        // Convert <i> to <em>
        cleaned = cleaned.replace(/<i(\s[^>]*)?>/gi, '<em>').replace(/<\/i>/gi, '</em>');
        
        // Remove underline
        cleaned = cleaned.replace(/<u(\s[^>]*)?>/gi, '').replace(/<\/u>/gi, '');
        
        // PRESERVE lists - don't convert lists to paragraphs!
        // First, protect list structures
        const listPlaceholder = '___LIST_PLACEHOLDER___';
        const lists: string[] = [];
        let listIndex = 0;
        
        // Save lists temporarily
        cleaned = cleaned.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, (match) => {
          lists.push(match);
          return `${listPlaceholder}${listIndex++}${listPlaceholder}`;
        });
        cleaned = cleaned.replace(/<ol[^>]*>[\s\S]*?<\/ol>/gi, (match) => {
          lists.push(match);
          return `${listPlaceholder}${listIndex++}${listPlaceholder}`;
        });
        
        // Normalize list tags (restore them later)
        // Now handle non-list divs
        // Don't convert divs that are inside lists (we've already saved those)
        // Convert standalone divs to paragraphs
        cleaned = cleaned.replace(/<div[^>]*>/gi, '<p>');
        cleaned = cleaned.replace(/<\/div>/gi, '</p>');
        
        // Restore lists
        listIndex = 0;
        cleaned = cleaned.replace(new RegExp(`${listPlaceholder}(\\d+)${listPlaceholder}`, 'g'), (_, index) => {
          const listHtml = lists[parseInt(index)];
          // Clean list HTML
          return listHtml
            .replace(/<ul[^>]*>/gi, '<ul>')
            .replace(/<ol[^>]*>/gi, '<ol>')
            .replace(/<li[^>]*>/gi, '<li>');
        });
        
        // Clean up empty paragraphs (but not inside lists)
        cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
        cleaned = cleaned.replace(/<p><br\s*\/?><\/p>/gi, '');
        cleaned = cleaned.replace(/<p>&nbsp;<\/p>/gi, '');
        cleaned = cleaned.replace(/<p>\s*&nbsp;\s*<\/p>/gi, '');

        console.log('Inserting cleaned HTML:', cleaned.substring(0, 200));

        // Insert into editor using TipTap's command
        setTimeout(() => {
          editor.commands.insertContent(cleaned);
        }, 0);
        
        return;
      }
      // If no HTML, let TipTap handle plain text normally
    };

    // Use capture phase to intercept before TipTap
    editorElement.addEventListener('paste', handlePaste as EventListener, true);
    
    return () => {
      editorElement.removeEventListener('paste', handlePaste as EventListener, true);
    };
  }, [editor]);

  // Update editor content when content prop changes
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>');
    }
  }, [content, editor]);

  const fontSizes = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];
  const [showFontSizeMenu, setShowFontSizeMenu] = React.useState(false);

  // Close font size menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.font-size-menu-container')) {
        setShowFontSizeMenu(false);
      }
    };

    if (showFontSizeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFontSizeMenu]);

  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLink = () => {
    const url = window.prompt('Enter link URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const currentFontSize = editor.getAttributes('textStyle').fontSize || '16px';

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-300">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-300' : ''}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-300' : ''}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Font Size Dropdown */}
        <div className="relative font-size-menu-container">
          <button
            onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
            className={`p-2 rounded hover:bg-gray-200 flex items-center gap-1 ${showFontSizeMenu ? 'bg-gray-300' : ''}`}
            title="Font Size"
          >
            <Type className="w-4 h-4" />
            <span className="text-xs">{currentFontSize.replace('px', '')}px</span>
          </button>
          {showFontSizeMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {fontSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    editor.chain().focus().setFontSize(`${size}px`).run();
                    setShowFontSizeMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 text-sm ${
                    currentFontSize === `${size}px` ? 'bg-blue-50 font-semibold' : ''
                  }`}
                  style={{ fontSize: `${size}px` }}
                >
                  {size}px
                </button>
              ))}
              <button
                onClick={() => {
                  editor.chain().focus().unsetFontSize().run();
                  setShowFontSizeMenu(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm border-t border-gray-200"
              >
                Default
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-300' : ''}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-300' : ''}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-300' : ''}`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('blockquote') ? 'bg-gray-300' : ''}`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          onClick={addLink}
          className="p-2 rounded hover:bg-gray-200"
          title="Add Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        <button
          onClick={addImage}
          className="p-2 rounded hover:bg-gray-200"
          title="Add Image"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-30"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-30"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content */}
      <div className="bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;

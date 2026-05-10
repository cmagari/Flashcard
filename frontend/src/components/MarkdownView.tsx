import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { apiBaseUrl } from "../api";

interface Props {
  source: string;
  className?: string;
}

function rewriteImageUrl(src: string | undefined): string | undefined {
  if (!src) return src;
  if (src.startsWith("app-image://")) {
    const filename = src.slice("app-image://".length);
    return `${apiBaseUrl()}/api/images/${filename}`;
  }
  return src;
}

// remark-math treats text on the same line after `$$` as a fence info string
// (like ` ```python `), which silently strips `\begin{...}` openings.
// Normalize multi-line `$$...$$` blocks so `$$` sit on their own lines.
function normalizeBlockMath(src: string): string {
  return src.replace(
    /(^|[^\\$])\$\$((?:\\\$|[^$])*?)\$\$/g,
    (match, prefix: string, content: string) => {
      if (!content.includes("\n")) return match;
      const trimmed = content.replace(/^[ \t]*\n?/, "").replace(/\n?[ \t]*$/, "");
      return `${prefix}$$\n${trimmed}\n$$`;
    },
  );
}

export default function MarkdownView({ source, className }: Props) {
  return (
    <div className={`markdown ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) =>
          url.startsWith("app-image://") ? url : defaultUrlTransform(url)
        }
        components={{
          img: ({ src, alt, ...rest }) => (
            <img src={rewriteImageUrl(src as string)} alt={alt ?? ""} {...rest} />
          ),
        }}
      >
        {normalizeBlockMath(source || "")}
      </ReactMarkdown>
    </div>
  );
}

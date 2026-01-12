# CC - Resume Builder

A template engine that generates HTML and PDF resumes from a single JSON data source.

## Quick Start

```bash
# Install dependencies
bun install

# Start development server with live reload
bun dev

# Build HTML and PDF for production
bun run build

# Build HTML only (faster)
bun run build:html
```

Outputs are generated in the `docs/` folder.

## Development Server

Start the dev server for real-time preview:

```bash
bun dev
```

This starts a local server at `http://localhost:3000` with:

- **Live reload** - Browser auto-refreshes when files change
- **File watching** - Monitors `resume.json`, `src/html/`, and `public/`
- **Hot reloading** - Uses Bun's `--hot` mode for instant server updates without restart
- **Fast rebuilds** - Only rebuilds HTML (skips PDF for speed)

The dev server is ideal for iterating on your resume content and styling. When you're ready to generate the final PDF, run `bun run build`.

## Private Resume

For sensitive information (phone number, address, etc.) that shouldn't be in the public resume:

1. Create `.hidden/secret.json` with private data:

```json
{
  "contact": {
    "phone": "+1 (555) 123-4567"
  }
}
```

2. Run `bun run build` - this generates:
   - `docs/<name>_cv.pdf` - Public version (no phone)
   - `.hidden/<name>_cv.pdf` - Private version (with phone)

PDF filenames are automatically generated from the `name` field (e.g., "Juan Almanza" → `juan_almanza_cv.pdf`).

The `.hidden/` folder is gitignored. The secret data is deep-merged with `resume.json`, so you can override any field.

## Prerequisites

- [Bun](https://bun.sh) - JavaScript runtime
- [LaTeX](https://www.latex-project.org/get/) with `pdflatex` (for PDF generation)

```bash
# macOS
brew install texlive

# Ubuntu/Debian
sudo apt-get install texlive-full

# Windows
# Install MiKTeX or TeX Live
```

## Project Structure

```
cc/
├── resume.json          # Your resume data (edit this)
├── .hidden/             # Private data (gitignored)
│   ├── secret.json      # Sensitive info (phone, etc.)
│   └── <name>_cv.pdf    # Private PDF with all data
├── src/
│   ├── engine.ts        # Template engine core
│   ├── index.ts         # Build script
│   ├── dev.ts           # Development server
│   ├── html/
│   │   └── index.html   # HTML template
│   └── latex/
│       └── resume.tex   # LaTeX template
├── public/
│   └── theme.css        # HTML styling
└── docs/                # Build output (public)
    ├── index.html
    └── <name>_cv.pdf
```

## Data Schema

Edit `resume.json` with your information:

```json
{
  "name": "Your Name",
  "location": "City, State",
  "contact": {
    "email": "you@example.com",
    "website": { "label": "yoursite.com", "url": "https://yoursite.com" },
    "github": { "label": "username", "url": "https://github.com/username" }
  },
  "education": [
    {
      "institution": "University",
      "degree": "BS in Field",
      "duration": "Aug 2020 – May 2024",
      "highlights": ["**Coursework:** Subject 1, Subject 2"]
    }
  ],
  "experience": [
    {
      "company": "Company",
      "position": "Title",
      "location": "City, State",
      "duration": "Jan 2023 – Present",
      "highlights": [
        "Achievement with **bold** emphasis and metrics."
      ]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "url": "https://project.com",
      "url_label": "project.com",
      "highlights": ["Description of what you built."]
    }
  ],
  "volunteering": [
    { "org": "Organization", "description": "What you did." }
  ],
  "honors": [
    { "title": "Award", "description": "Details", "year": "2024" }
  ],
  "skills": [
    { "category": "Languages", "items": "Python, JavaScript, C++" }
  ]
}
```

## Template Syntax

### Variable Substitution

Access data using dot notation for nested values.

**HTML templates:**
```html
<h1>{{name}}</h1>
<p>{{contact.email.personal}}</p>
```

**LaTeX templates** (use `@{...}@` to avoid conflicts with LaTeX syntax):
```latex
\textbf{@{name}@}
\href{mailto:@{contact.email.personal}@}{Email}
```

### Template Includes

Include other template files using `<<path>>`. Paths are relative to the current template's directory.

```html
<!-- In src/html/index.html -->
<<header.html>>
<<components/email.html>>
```

```latex
% In src/latex/resume.tex
<<sections/education.tex>>
```

### Loops

Iterate over arrays with `[[for item in array]]`:

```html
[[for job in experience]]
<div class="job">
  <h3>{{job.company}}</h3>
  <p>{{job.position}}</p>
  [[for task in job.responsibilities]]
  <li>{{task}}</li>
  [[endfor]]
</div>
[[endfor]]
```

Loops can be nested. The inner loop accesses the parent's iterator variable.

### Conditionals

Show content only if a field exists:

```html
[[if contact.phone]]
<p>Phone: {{contact.phone}}</p>
[[endif]]
```

```latex
[[if contact.phone]] $\cdot$ \phone{@{contact.phone}@}[[endif]]
```

Conditionals can be nested and work with any field path.

**LaTeX alternative syntax** with `{{#each}}`:
```latex
{{#each skills}}
\item {{this}}
{{/each}}
```

### Bold Text

Use markdown-style `**bold**` in your JSON data:

```json
{
  "summary": "Expert in **machine learning** and **data analysis**."
}
```

This automatically converts to:
- HTML: `<strong>machine learning</strong>`
- LaTeX: `\textbf{machine learning}`

## Special Behaviors

### Email Obfuscation

Email addresses in HTML are automatically formatted as `user [at] domain.com` for spam protection. This does **not** apply to `mailto:` links, which preserve the original format.

### LaTeX Character Escaping

These characters are automatically escaped in LaTeX output:

| Character | Escaped As |
|-----------|------------|
| `\` | `\textbackslash{}` |
| `&` | `\&` |
| `%` | `\%` |
| `$` | `\$` |
| `#` | `\#` |
| `_` | `\_` |
| `{` | `\{` |
| `}` | `\}` |
| `^` | `\textasciicircum{}` |
| `~` | `\textasciitilde{}` |

### PDF Generation

The build process runs `pdflatex` twice to ensure proper resolution of references and links. Temporary files (`.aux`, `.log`, `.out`) are automatically cleaned up.

## Customization

### Styling

- **HTML**: Edit `public/theme.css` for web styling
- **LaTeX**: Modify packages and formatting in `src/latex/resume.tex`

### Adding Sections

1. Create a new template file (e.g., `src/html/publications.html`)
2. Add the include directive to the main template: `<<publications.html>>`
3. Add corresponding data to `resume.json`

### Creating Components

Reusable components go in `src/html/components/`. Include them with:

```html
<<components/social-link.html>>
```

## Troubleshooting

### PDF generation fails

1. Verify `pdflatex` is installed: `which pdflatex`
2. Check for LaTeX syntax errors in the console output
3. Ensure all required LaTeX packages are installed
4. Look for unescaped special characters (the engine handles most, but custom LaTeX code needs manual escaping)

### Variables not rendering

1. Check for typos in variable names
2. Verify the path matches your JSON structure (use dot notation: `contact.email.personal`)
3. Ensure arrays use the correct `[[for]]` syntax

### Build errors

1. Run `bun install` to ensure dependencies are installed
2. Check that `resume.json` is valid JSON (no trailing commas, proper quotes)

## Engine API

The template engine exports these functions for programmatic use:

```typescript
import { compile, read, write, minifyHTML } from "./src/engine";

// Compile a template with data
const html = compile("html/index.html", resumeData);

// Read a file relative to src/
const content = read("../resume.json");

// Write a file relative to src/
write("../docs/output.html", content);

// Minify HTML output
const minified = minifyHTML(html);
```

## License

MIT

# CC - Resume Builder

Generate HTML and PDF resumes using Bun and LaTeX.

## Setup

### Prerequisites

- [Bun](https://bun.sh) - JavaScript runtime
- [LaTeX](https://www.latex-project.org/get/) (with `pdflatex`) - PDF generation
  - macOS: `brew install texlive`
  - Ubuntu/Debian: `sudo apt-get install texlive-full`
  - Windows: Install MiKTeX or TeX Live

### Usage

1. Edit `resume.json` with your data
2. Run `bun start` to build HTML and PDF versions
3. Use `bun start --no-pdf` to skip PDF generation
4. Find outputs in the `docs` folder:
   - `index.html` - Web version
   - `resume.pdf` - PDF version
5. Contents of `public/` directory are copied to `docs/` (for CSS, images, etc.)

## Template System

### Locations

- `src/html/` - HTML templates (main: `index.html`)
- `src/latex/` - LaTeX templates (main: `resume.tex`)

### Syntax

**HTML Templates:**
- `{{key}}` - Insert content from resume.json (supports `{{person.name}}`)
- `<<path/to/template.html>>` - Include another template

**LaTeX Templates:**
- `@{key}@` - Insert content from resume.json (supports `@{person.name}@`)
- `<<path/to/template.tex>>` - Include another template

**Common Features:**
- Loops: `[[for item in arrayKey]] ... [[endfor]]`
- Bold text: `**bold**` in JSON converts to `<strong>` (HTML) or `\textbf{}` (LaTeX)
- LaTeX templates also support `{{#each arrayKey}} ... {{/each}}` with `{{this}}`

### Customization

- HTML: Edit files in `src/html/` and CSS in `public/`
- LaTeX: Modify `.tex` files in `src/latex/`

### Special Behaviors

- Emails format as `user [at] domain.com` in HTML (not in `mailto:` links)
- LaTeX special characters (`%`, `$`, `_`, etc.) automatically escaped
- LaTeX compilation runs twice for proper references
- Temporary LaTeX files (`.aux`, `.log`, `.out`) automatically removed

### Troubleshooting PDF Generation

- Verify `pdflatex` is installed and accessible
- Check console for LaTeX errors
- Ensure required LaTeX packages are installed
- Look for syntax errors in LaTeX templates
- Watch for unescaped special characters in your JSON data

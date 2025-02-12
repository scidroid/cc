# CC - Resume Builder: Export to HTML and PDF

A lightweight, dependency-free solution using Bun and LaTeX.

## Getting Started

1. Edit the `resume.json` file located in the root directory.
2. Run the following command to build the resume:
   ```sh
   bun src/start.ts
   ```

## Templates

Templates are stored in the `src/templates` folder.

By default, the `index.html` file is compiled.

### Template Syntax

- `{{key}}`: Inserts content from the `resume.json` file.
- `<<key>>`: Renders a new template. `key` refers to the filename within the templates directory.
- [[if condition]] ... [[endif]]: Conditionally renders content based on a condition.
- [[for item in list]] ... [[endfor]]: Iterates over a list and renders content for each item.

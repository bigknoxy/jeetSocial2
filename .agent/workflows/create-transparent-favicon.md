---
description: Create a truly transparent favicon using AI generation and ImageMagick
---
This workflow describes how to create a high-fidelity favicon with a true transparent background by using a chroma-key extraction technique.

### 1. Generate the Base Image
Generate a new image using the `generate_image` tool. Use a prompt that specifies a solid, high-contrast background color (like Neon Green `#00FF00`) to act as a "green screen".

**Prerequisites**:
- The `generate_image` tool must be used to create the source asset.
- Prompt must explicitly request a "solid uniform neon green background" with "no gradients".

### 2. Identify the Chroma Color
Inspect the generated image to identify the exact color of the background. AI generators may produce a slightly different green than requested (e.g., `#82ff00` instead of `#00FF00`).

// turbo
### 3. Extract Transparency
Use `convert` (ImageMagick) to replace the background color with true alpha-channel transparency.

```bash
convert [input_path] -fuzz 15% -transparent "[background_color]" [output_path]
```

*Note: The `-fuzz 15%` flag is critical to handle anti-aliasing around the edges of the subject for a professional look.*

### 4. Deploy Asset
1. Move the result to `app/client/public/favicon.png`.
2. Update the favicon link in `index.html` with a versioned query string (e.g., `href="/favicon.png?v=6"`) to bypass browser caching.

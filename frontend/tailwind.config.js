    /** @type {import('tailwindcss').Config} */
    module.exports = {
      content: [
        "./src/**/*.{js,jsx,ts,tsx}", // Scans all JS, JSX, TS, TSX files in src/
        "./public/index.html"        // Scans your public HTML file
      ],
      theme: {
        extend: {},
      },
      plugins: [],
    }
    
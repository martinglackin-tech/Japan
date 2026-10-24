/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
    content: ['./index.html', './app.js', './data.js'],
    darkMode: 'class',
    theme: {
        extend: {
            // Defined in src/input.css; Izakaya mode swaps the values.
            colors: {
                paper: token('paper'),
                surface: token('surface'),
                'surface-2': token('surface-2'),
                ink: token('ink'),
                muted: token('muted'),
                line: token('line'),
                accent: token('accent'),
                'accent-soft': token('accent-soft'),
                hinomaru: '#bc002d'
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                jp: ['"Noto Sans JP"', 'sans-serif'],
                display: ['"Shippori Mincho"', '"Noto Serif JP"', 'serif']
            }
        }
    }
};

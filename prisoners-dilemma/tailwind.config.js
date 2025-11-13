/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: 'media', // use system preference
    theme: {
        extend: {
            colors: {
                // You can add custom colors here if needed
            },
        },
    },
    plugins: [],
} 
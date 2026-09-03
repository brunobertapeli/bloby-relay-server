/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // ── Type ─────────────────────────────────────────────────────────
      // Gabarito: round, chunky, friendly — Morphy's voice for headlines.
      // Figtree: warm, legible geometric for body copy.
      // DM Mono: soft monospace for commands, handles and URLs.
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Gabarito', 'Figtree', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Tonal surfaces — layered ink, never flat gray.
        surface: {
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
        },
        // Morphy's own colours: the sky-blue top of the blob, the deep blue
        // of its body, and the little cyan glint on its surface.
        sky: "hsl(var(--sky))",
        glint: "hsl(var(--glint))",
        // One warm accent, used in tiny doses so the blue world feels alive.
        spark: "hsl(var(--spark))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        blob: "1.75rem",
        band: "2.5rem",
      },
      boxShadow: {
        // Soft lift for cards; no neon glow.
        lift: "0 1px 0 0 hsl(0 0% 100% / 0.04) inset, 0 12px 32px -16px hsl(228 40% 2% / 0.7)",
        "lift-lg": "0 1px 0 0 hsl(0 0% 100% / 0.05) inset, 0 24px 48px -20px hsl(228 40% 2% / 0.8)",
        // Morphy material — glossy top edge and a blue-tinted drop shadow.
        morphy: "inset 0 1px 0 hsl(0 0% 100% / 0.35), inset 0 -2px 0 hsl(220 80% 20% / 0.25), 0 10px 24px -10px hsl(215 100% 50% / 0.55)",
        "morphy-lg": "inset 0 1px 0 hsl(0 0% 100% / 0.4), inset 0 -3px 0 hsl(220 80% 20% / 0.25), 0 18px 40px -14px hsl(215 100% 50% / 0.6)",
      },
      transitionTimingFunction: {
        // Back-out overshoot: the "alive" easing used for entrances.
        squish: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Gentle bob for idle mascots and floating chips.
        bob: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        // Squash & stretch — Morphy's body language.
        squish: {
          "0%": { transform: "scale(1, 1)" },
          "30%": { transform: "scale(1.08, 0.92)" },
          "60%": { transform: "scale(0.97, 1.04)" },
          "100%": { transform: "scale(1, 1)" },
        },
        // Pop-in with overshoot for badges and status dots.
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Slow breathing glow — the light Morphy casts around itself.
        breathe: {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.06)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "border-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        bob: "bob 5s ease-in-out infinite",
        "bob-slow": "bob 7s ease-in-out infinite",
        squish: "squish 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
        pop: "pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        breathe: "breathe 6s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        shimmer: "shimmer 2.4s linear infinite",
        // Legacy aliases kept so untouched pages keep working.
        float: "bob 6s ease-in-out infinite",
        "float-slow": "bob 8s ease-in-out infinite",
        "float-slower": "bob 10s ease-in-out infinite",
        "glow-pulse": "breathe 6s ease-in-out infinite",
        "grid-fade": "breathe 8s ease-in-out infinite",
        "slide-in-left": "pop 0.5s ease-out",
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

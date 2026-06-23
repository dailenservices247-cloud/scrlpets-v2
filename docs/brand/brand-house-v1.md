# Scrlpets Brand Token Reference

This public repository includes only the Scrlpets-specific brand tokens needed to build and review the app.

The full portfolio Brand House lives in private project docs. Do not copy private brand architecture, planning notes, or unreleased product strategy into this public repository.

## Public Palette

| Token | Hex | Use |
|---|---|---|
| `shell` | `#3a3b3d` | primary dark surface |
| `shell-deep` | `#2a2a2d` | recessed dark surface |
| `cream` | `#efede5` | primary text on dark |
| `cream-deep` | `#e0ddd0` | secondary light surface |
| `wine` | `#7e303a` | primary accent fills, badges, primary actions |
| `wine-bright` | `#a0414e` | accent hover and live indicators |
| `wine-text` | `#e09aa4` | links, labels, and text accents on dark |
| `gold` | `#c8a23e` | reserve accent for rare premium/loyalty moments |
| `gold-bright` | `#d8b85a` | reserve accent hover/emphasis |
| `spine` | `#2a6055` | structural/verification surfaces |
| `spine-bright` | `#347466` | structural hover/emphasis |
| `ink-strong` | `#ffffff` | maximum-emphasis text |
| `ink-muted` | `#9b9b96` | secondary text on deep dark surfaces |
| `ink-muted-card` | `#a9a9a4` | secondary text on card surfaces |
| `ink-dim` | `#6c6c69` | tertiary text |
| `border-subtle` | `#4a4b4d` | default border |
| `border-strong` | `#5c5d5f` | emphasized border |

## Typography

- Sans: Geist Sans
- Mono: Geist Mono
- Use two weights by default: regular and medium.
- Eyebrows use mono, uppercase, 11px, `wine-text`.

## Accessibility Notes

- Do not use `wine` as body text on dark backgrounds.
- Use `wine-text` for text accents on dark surfaces.
- Use `ink-muted-card` for muted text on card surfaces.
- Keep destructive/error states separate from wine accent styling.

## Usage Rules

- Use one accent family per component.
- Use gold sparingly.
- Avoid decorative gradients unless they are explicitly part of a reviewed design pass.
- Add new public tokens here only after they are approved in the private Brand House.

## Logo Notes

The public app uses the Scrlpets wordmark and app icon assets already committed under `public/brand/` and app metadata files.

Do not commit unreleased logo explorations, rejected concepts, or regeneration prompts to the public repo.

## Machine-Readable Tokens

Use `docs/brand/brand-tokens-v1.css` and `src/app/globals.css` for the current machine-readable token mapping.

# CPE Course - File Naming Convention

## General Pattern

All downloaded files follow this format:

```
Clase-X[-Parte-Y]-[DESCRIPTIVE_TITLE]-[TYPE].[ext]
```

### Components:
- **Clase-X**: Class number (1-11 for Biomecánica, varies per subject)
- **[-Parte-Y]**: Part number (optional, only if multiple parts per class)
- **[DESCRIPTIVE_TITLE]**: Human-readable lesson title (kebab-case, spaces → hyphens)
- **[TYPE]**: Either `audio` or `slides`
- **.[ext]**: File extension (.mp3 for audio, .pdf for slides)

---

## Examples from Biomecánica (01)

### Good Examples:
```
Clase-1-Parte-1-Introduccion-a-la-biomecanica-por-que-es-importante-audio.mp3
Clase-1-Parte-1-Introduccion-a-la-biomecanica-por-que-es-importante-slides.pdf
Clase-2-Parte-2-Sistema-osteoarticular-audio.mp3
Clase-4-Biomecanica-del-aparato-locomotor-Pie-audio.mp3
Clase-9-Parte-5-Perfiles-de-resistencia-en-ejercicios-de-abdomen-slides.pdf
```

### Bad Examples (What We Avoided):
```
❌ Clase-1-Parte-1-audio.mp3
❌ CPE-CLASE-1-PARTE-1-AUDIO.mp3
❌ Introduccion-a-la-biomecanica-audio.mp3
```

---

## Why This Matters for NextJS

When building the study platform UI, these descriptive filenames allow:

1. **Auto-generated Cards**: Extract lesson title directly from filename
   ```javascript
   const title = filename
     .replace(/^Clase-\d+-?/, '')           // Remove "Clase-X-"
     .replace(/-(audio|slides)\./, '')      // Remove "-audio/slides"
     .replace(/-/g, ' ')                     // Convert hyphens to spaces
     .replace(/\b\w/g, c => c.toUpperCase()) // Capitalize words
   ```

2. **Smart Routing**: Group by class number
   ```javascript
   const classNum = filename.match(/Clase-(\d+)/)[1]
   const parts = files.filter(f => f.includes(`Clase-${classNum}`))
   ```

3. **Content Organization**: Separate audio from slides
   ```javascript
   const audioFiles = files.filter(f => f.includes('-audio.mp3'))
   const slideFiles = files.filter(f => f.includes('-slides.pdf'))
   ```

---

## Biomecánica (01) - Complete Reference

| Clase | Partes | Naming |
|-------|--------|--------|
| 1 | 5 | Introduccion-a-la-biomecanica-por-que-es-importante |
| 1 | 5 | La-fuerza-y-los-planos-de-movimiento |
| 1 | 5 | La-inercia-y-la-friccion |
| 1 | 5 | Brazo-de-momento |
| 1 | 5 | Repaso-y-analisis-biomecanico |
| 2 | 2 | Bases-de-la-anatomia |
| 2 | 2 | Sistema-osteoarticular |
| 3 | 1 | Hipertrofia-fuerza-y-perfiles-de-resistencia |
| 4 | 1 | Biomecanica-del-aparato-locomotor-Pie |
| 5 | 1 | Biomecanica-del-aparato-locomotor-Rodilla |
| 6 | 1 | Biomecanica-del-aparato-locomotor-Cadera |
| 7 | 1 | Biomecanica-del-aparato-locomotor-Codo-y-mano |
| 8 | 1 | Biomecanica-del-aparato-locomotor-Hombro |
| 9 | 5 | Biomecanica-del-aparato-locomotor-Craneo-y-raquis |
| 9 | 5 | Perfiles-de-resistencia-en-ejercicios-de-empuje |
| 9 | 5 | Perfiles-de-resistencia-en-ejercicios-de-tiron |
| 9 | 5 | Perfiles-de-resistencia-brazos-biceps-y-triceps |
| 9 | 5 | Perfiles-de-resistencia-en-ejercicios-de-abdomen |
| 10 | 2 | Dolor-Como-funciona-y-como-combatirlo |
| 10 | 2 | Abordaje-del-dolor-desde-el-ejercicio-fisico |
| 11 | 1 | Biomecanica-de-la-respiracion-poleas-y-puntos-de-estancamiento |

---

## Rules for Next Subjects

When downloading remaining subjects (02-29):

1. **Extract actual lesson titles** from source files (Dropbox/Google Drive)
2. **Maintain class/part structure** from course
3. **Convert titles to kebab-case**:
   - Spaces → hyphens
   - Special chars (é, á, etc.) → standard ASCII
   - UPPERCASE → lowercase
4. **Always include TYPE suffix**: `-audio` or `-slides`
5. **Keep hyphens between Clase-X and title** for consistency

---

## Script Template for Automation

For each new subject, create:
```bash
scripts/rename-[subject]-proper.sh
```

The script will:
1. Parse links.txt to extract lesson titles
2. Generate rename mapping based on this convention
3. Execute batch rename operation
4. Verify all files renamed correctly

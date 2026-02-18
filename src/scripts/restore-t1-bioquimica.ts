import { prisma } from '../lib/db'

const T1_BIOQUIMICA_CONTENT = `# CORNELL NOTES: T1 Introducción a la bioquímica y organización molecular

## 📋 INFORMACIÓN DE LA LECCIÓN
- **Asignatura:** Bioquímica
- **Tema:** Tema 1 - Introducción a la bioquímica y organización molecular
- **Duración aproximada:** 45-60 minutos
- **Nivel de dificultad:** Alto (requiere base de química orgánica)

---

## 📝 COLUMNA DE PREGUNTAS CLAVE

1. ¿Qué porcentaje de la célula es agua y por qué es tan importante?
2. ¿Cuáles son las cuatro biomoléculas principales y sus funciones?
3. ¿Qué son los organelos/orgánulos y cuáles son los más importantes para el metabolismo?
4. ¿Qué función tienen las mitocondrias y por qué se llaman "centrales energéticas"?
5. ¿Dónde ocurre la síntesis de proteínas?
6. ¿Qué diferencia hay entre cationes y aniones?
7. ¿Qué son los isótopos?
8. ¿Cuál es la diferencia entre número atómico y número másico?
9. ¿Cómo se organiza la tabla periódica (periodos vs grupos)?
10. ¿Por qué las moléculas orgánicas se llaman así?
11. ¿Qué función cumplen las enzimas?
12. ¿Qué papel juegan los iones inorgánicos en la célula?
13. ¿Cuáles son las tres funciones principales de la membrana plasmática?
14. ¿Qué es la autofagia y qué orgánulos participan?
15. ¿Cómo se coordinan las diferentes rutas metabólicas en la célula?

---

## 📖 NOTAS PRINCIPALES

### 1. Composición y Estructura de la Célula

La célula es la unidad fundamental donde ocurren todas las reacciones bioquímicas. Su composición es:

**Agua (70% del peso celular)**
- Es el medio donde suceden TODAS las reacciones bioquímicas
- Determina múltiples procesos fisiológicos:
  - Comportamiento del pH
  - Reactividad de las moléculas
  - Regulación de la temperatura corporal
- *Nota del profesor:* "Es tan importante que la vamos a ver aparte porque el agua va a determinar muchas cosas"

**Organelos (orgánulos)**
- Son estructuras internas con funciones específicas
- Están suspendidos en el citoplasma
- Cada uno realiza funciones metabólicas distintas

---

### 2. Las Cuatro Biomoléculas Principales

#### A) Carbohidratos
| Función | Ejemplo/Detalle |
|---------|-----------------|
| Combustible energético | Fuente inmediata de energía |
| Reserva energética | Glucógeno (almacén en músculos e hígado) |
| Estructura | Forman estructuras celulares en membranas |
| Comunicación celular | Participan en reconocimiento entre células |

#### B) Lípidos
| Función | Ejemplo/Detalle |
|---------|-----------------|
| Reserva energética | Triglicéridos (grasa almacenada) |
| Estructura | Fosfolípidos → principal componente de membranas |
| Señalización | Actúan como moléculas señalizadoras |

#### C) Proteínas
*"Son súper, súper, súper importantes"* - Profesor

| Función | Ejemplo/Detalle |
|---------|-----------------|
| Enzimas | Facilitan reacciones bioquímicas |
| Transporte | Transportadores como GLUT4 (entrada de glucosa en músculo) |
| Estructura | Fibras musculares |
| Receptores | Captan señales externas |

#### D) Ácidos Nucleicos
- **ADN:** Almacena información genética
- **ARN:** Intermedio para síntesis de proteínas

---

### 3. Iones Inorgánicos

**Ejemplos principales:** Sodio (Na⁺), Potasio (K⁺), Magnesio (Mg²⁺), Calcio (Ca²⁺)

**Funciones:**
- Actúan como **cofactores enzimáticos** (ayudan a que las enzimas funcionen)
- Facilitan reacciones bioquímicas
- Esenciales para contracción muscular (especialmente calcio)
- Mantienen equilibrio en células nerviosas y cardíacas
- Regulan el equilibrio osmótico celular

---

### 4. Organelos Celulares Importantes para Bioquímica

#### Membrana Plasmática
- **Función estructural:** Envuelve y protege la célula
- **Transporte de nutrientes e iones:** Controla qué entra y sale
- **Evita que la célula "explote o se arrugue"** (equilibrio osmótico)
- **Señalización celular:** Reconocimiento de antígenos y patógenos

#### Citoplasma
- Líquido interno donde flotan los orgánulos
- **Sede de muchas reacciones bioquímicas**
- Muy importante en metabolismo

#### Mitocondrias ⭐
*"Son como las centrales de producción energética de la célula"*

Reacciones metabólicas clave que ocurren aquí:
1. **Beta-oxidación** (degradación de grasas)
2. **Ciclo de Krebs** (producción de energía)
3. **Cadena de transporte electrónico** (producción de ATP)

#### Núcleo Celular
- Contiene la información genética (ADN)
- El ADN se transforma en ARN (transcripción)
- El ARN sale del núcleo para ir a los ribosomas
- **Las proteínas NO se sintetizan dentro del núcleo**

#### Ribosomas
- **Lugar donde ocurre la síntesis de proteínas**
- El ARN mensajero llega aquí desde el núcleo
- Las cadenas de aminoácidos se pliegan aquí
- *Nota:* "Hay un vídeo muy chulo" que muestra este proceso

#### Aparato de Golgi
- Ubicado cerca del núcleo
- Función: modificación y empaquetamiento de moléculas
- También tiene ribosomas asociados

#### Lisosomas y Peroxisomas
- **Degradación, digestión y detoxificación** de moléculas
- Responsables de la **autofagia**:
  - Proceso de regeneración y limpieza celular
  - Degradan productos de desecho
  - *Estímulos que la activan:* entrenamiento, ayuno intermitente, déficit calórico

#### Citoesqueleto
- Implicado en división celular
- Da estructura y movimiento a la célula
- Organiza el transporte interno

---

### 5. Coordinación Metabólica Celular

**Flujo de nutrientes:**
\`\`\`
Alimentos → Digestión → Sangre → Órganos → Tejidos → Células
\`\`\`

**Tres funciones celulares principales:**
1. **Catabolismo:** Degradación de moléculas para obtener energía
2. **Anabolismo:** Construcción de moléculas nuevas
3. **Señalización:** Comunicación entre células

**Regulación del metabolismo:**
- Las diferentes rutas metabólicas pueden estar activas simultáneamente
- *"No es que se active el metabolismo de carbohidratos y se inhiba el de lípidos. Pueden estar activos ambos"*
- La regulación depende de:
  - **Hormonas**
  - **Neurotransmisores**
  - **Comunicadores celulares**

---

### 6. Estructura Atómica y Moléculas Orgánicas

#### ¿Por qué "orgánicas"?
Porque todas tienen como base átomos de **carbono** (C).

#### Componentes del Átomo

| Partícula | Carga | Ubicación |
|-----------|-------|-----------|
| Protones | Positiva (+) | Núcleo |
| Neutrones | Neutra (0) | Núcleo |
| Electrones | Negativa (-) | Orbitales |

**Estado normal:** Los átomos son neutros (protones = electrones)

#### Iones
| Tipo | Definición | Ejemplo |
|------|------------|---------|
| **Catión** | Átomo con carga positiva (más protones que electrones) | Ca²⁺ (calcio) |
| **Anión** | Átomo con carga negativa (más electrones que protones) | Cl⁻ (cloro), I⁻ (yodo) |

#### Estructura del Átomo

**Núcleo:**
- Contiene protones y neutrones
- **Número másico** = protones + neutrones (número de arriba en tabla periódica)
- **Número atómico** = número de protones (número de abajo en tabla periódica)

**Orbitales:**
- Estructuras que representan la trayectoria de los electrones
- Los electrones giran constantemente alrededor del núcleo
- Puede haber uno o varios orbitales según el elemento

#### Isótopos
**Definición:** Diferentes formas atómicas del mismo elemento que difieren en el número de neutrones.

- **Mismo número atómico** (mismos protones)
- **Diferente número másico** (diferentes neutrones)

---

### 7. La Tabla Periódica

#### Análisis Horizontal (Periodos)
- Los elementos aumentan en número de electrones y protones
- Mantienen el **mismo nivel de energía**
- A la derecha → mayor número de electrones

#### Análisis Vertical (Grupos)
- Diferentes niveles de energía
- Mayor energía conforme bajamos
- Más orbitales conforme bajamos

#### Implicaciones para Bioquímica
- **Moléculas muy cargadas = moléculas muy reactivas**
- La reactividad depende de:
  - Cantidad de electrones
  - Número de orbitales
  - Posición en la tabla periódica

---

## 🔑 CONCEPTOS Y DEFINICIONES CLAVE

| Término | Definición |
|---------|------------|
| **Bioquímica** | Ciencia que estudia las reacciones químicas que ocurren en los seres vivos |
| **Organelos/Orgánulos** | Estructuras internas de la célula con funciones específicas |
| **Citoplasma** | Líquido interno de la célula donde se encuentran los orgánulos |
| **Mitocondria** | Orgánulo encargado de la producción de energía; "central energética" |
| **Ribosoma** | Orgánulo donde se sintetizan las proteínas |
| **Enzima** | Proteína que facilita/acelera las reacciones bioquímicas |
| **Catabolismo** | Conjunto de reacciones de degradación de moléculas |
| **Anabolismo** | Conjunto de reacciones de construcción de moléculas |
| **Autofagia** | Proceso de degradación y reciclaje de componentes celulares dañados |
| **Catión** | Átomo con carga positiva (perdió electrones) |
| **Anión** | Átomo con carga negativa (ganó electrones) |
| **Isótopo** | Variante de un elemento con diferente número de neutrones |
| **Número atómico** | Cantidad de protones de un átomo (identifica al elemento) |
| **Número másico** | Suma de protones + neutrones (indica la masa) |

---

## 📊 DIAGRAMAS (TEXTUALES)

### Composición de la Célula
\`\`\`
                      CÉLULA EUCARIOTA
    ┌─────────────────────────────────────────────┐
    │                                             │
    │   ┌─────┐                                   │
    │   │NÚCLEO│ ← ADN → ARN                      │
    │   └─────┘                                   │
    │                      ○○○ Ribosomas          │
    │   🔋🔋🔋 Mitocondrias (ATP)                  │
    │                                             │
    │   ▣ Aparato de Golgi                        │
    │   ◉ Lisosomas                               │
    │   ═══ Retículo Endoplasmático               │
    │                                             │
    │ ═══════════════════════════════════════════ │
    │             Membrana Plasmática             │
    └─────────────────────────────────────────────┘

    💧 70% AGUA (medio de todas las reacciones)
\`\`\`

### Flujo de Información Genética
\`\`\`
    ADN (núcleo)
         │
         ▼ Transcripción
    ARN mensajero
         │
         ▼ Sale del núcleo
    Ribosomas
         │
         ▼ Traducción
    PROTEÍNA
\`\`\`

### Estructura del Átomo
\`\`\`
NÚMERO ATÓMICO = número de protones
NÚMERO MÁSICO = protones + neutrones
\`\`\`

### Tabla Periódica - Tendencias
\`\`\`
        ← Menos electrones    Más electrones →

    ↑   H  He                              Menor energía
    │   Li Be B  C  N  O  F  Ne            Menos orbitales
    │   Na Mg Al Si P  S  Cl Ar
    │   K  Ca ...
    ↓                                      Mayor energía
                                           Más orbitales

→ A la DERECHA: más electrones (misma energía)
→ Hacia ABAJO: más orbitales (mayor energía)
→ MÁS CARGA = MÁS REACTIVIDAD
\`\`\`

---

## ⚡ RESUMEN

La bioquímica estudia todas las reacciones químicas que ocurren en las células de los seres vivos. Este primer tema establece las bases fundamentales: la célula está compuesta en un 70% por agua, que es el medio donde ocurren todas las reacciones bioquímicas y determina procesos críticos como el pH, la reactividad molecular y la regulación térmica. El resto de la célula contiene orgánulos especializados y biomoléculas que trabajan de forma coordinada.

Las cuatro biomoléculas principales son: **carbohidratos** (energía y reserva como glucógeno), **lípidos** (reserva energética como triglicéridos y estructura de membranas como fosfolípidos), **proteínas** (enzimas que catalizan reacciones, transportadores, estructura y receptores), y **ácidos nucleicos** (ADN y ARN para almacenamiento y expresión de información genética). Además, los iones inorgánicos como sodio, potasio, calcio y magnesio actúan como cofactores enzimáticos y son esenciales para funciones como la contracción muscular y el equilibrio celular.

Los orgánulos más importantes para el metabolismo son: las **mitocondrias** (centrales energéticas donde ocurren la beta-oxidación, ciclo de Krebs y cadena de transporte electrónico), los **ribosomas** (síntesis de proteínas), el **núcleo** (contiene el ADN), y los **lisosomas/peroxisomas** (degradación y autofagia). El citoplasma es el medio líquido donde flotan estos orgánulos y donde ocurren muchas reacciones metabólicas. La membrana plasmática no solo protege la célula sino que regula el transporte y participa en señalización.

A nivel atómico, las moléculas orgánicas se caracterizan por tener carbono como base. Los átomos están formados por protones y neutrones (en el núcleo) y electrones (en orbitales). El número atómico indica los protones, mientras que el número másico es la suma de protones y neutrones. Los isótopos son variantes del mismo elemento con diferente número de neutrones. La tabla periódica organiza los elementos: horizontalmente aumentan electrones a misma energía, verticalmente aumentan los niveles de energía (orbitales). Las moléculas muy cargadas son muy reactivas, concepto fundamental para entender las reacciones bioquímicas.

La célula funciona como una red coordinada donde el catabolismo (degradación), anabolismo (construcción) y señalización trabajan simultáneamente, regulados por hormonas, neurotransmisores y comunicadores celulares. Este tema sienta las bases para entender todo el metabolismo que se estudiará posteriormente.

---

## ✅ AUTOEVALUACIÓN

**P1:** ¿Por qué el agua constituye el 70% del peso celular y qué procesos determina?
**R:** El agua es el medio donde suceden TODAS las reacciones bioquímicas. Determina el comportamiento del pH, la reactividad de las moléculas y la regulación de la temperatura corporal. Sin agua, las reacciones enzimáticas y metabólicas no podrían ocurrir.

---

**P2:** Un paciente tiene deficiencia de calcio. ¿Qué funciones celulares podrían verse afectadas?
**R:** El calcio es un ion inorgánico esencial para: 1) La contracción muscular (incluyendo el músculo cardíaco), 2) Actuar como cofactor de ciertas enzimas, 3) El equilibrio y funcionamiento de células nerviosas. Una deficiencia podría causar debilidad muscular, calambres, arritmias cardíacas y problemas de señalización nerviosa.

---

**P3:** ¿Dónde se sintetizan las proteínas y qué ruta sigue la información desde el ADN?
**R:** Las proteínas se sintetizan en los **ribosomas**, NO en el núcleo. La ruta es: ADN (en el núcleo) → se transcribe a ARN → el ARN sale del núcleo → llega al ribosoma → se traduce a proteína (las cadenas de aminoácidos se pliegan).

---

**P4:** Explica la diferencia entre número atómico y número másico con un ejemplo.
**R:** El **número atómico** es el número de protones (identifica al elemento). El **número másico** es la suma de protones + neutrones (determina la masa). Ejemplo: El carbono tiene número atómico 6 (6 protones). El Carbono-12 tiene número másico 12 (6 protones + 6 neutrones), mientras que el Carbono-14 tiene número másico 14 (6 protones + 8 neutrones). Ambos son carbono (mismo número atómico) pero son isótopos diferentes.

---

**P5:** ¿Qué es la autofagia, qué orgánulos participan y qué estímulos la activan?
**R:** La autofagia es un proceso de regeneración y limpieza celular donde se degradan productos de desecho y componentes dañados. Participan los **lisosomas y peroxisomas**. Se estimula con: entrenamiento físico, ayuno intermitente y déficit calórico.

---

**P6:** ¿Por qué se dice que las mitocondrias son las "centrales energéticas" de la célula?
**R:** Porque en las mitocondrias ocurren las principales reacciones de producción de energía (ATP): la beta-oxidación (degradación de ácidos grasos), el ciclo de Krebs y la cadena de transporte electrónico. Son responsables de generar la mayor parte de la energía que la célula necesita para funcionar.

---

**P7:** Si un átomo tiene más electrones que protones, ¿qué tipo de ion es y qué carga tiene? Da un ejemplo.
**R:** Es un **anión**, con carga negativa. Ejemplos: el cloro (Cl⁻) y el yodo (I⁻). Estos átomos han ganado electrones, por lo que tienen más cargas negativas que positivas.

---

## 🔗 CONEXIONES

### Con temas anteriores:
- **Química del bachillerato:** Estructura atómica, tabla periódica, enlaces químicos
- **Biología celular básica:** Estructura de la célula eucariota
- **Química orgánica:** Concepto de moléculas basadas en carbono

### Con temas futuros (mencionados por el profesor):
- **pH y pKa:** Se verá en las próximas clases; conceptos importantes que conviene repasar
- **Propiedades del agua:** Tema dedicado debido a su importancia
- **Tema de carbohidratos:** Profundización en glucógeno, glucosa, metabolismo
- **Tema de lípidos:** Triglicéridos, fosfolípidos, beta-oxidación
- **Tema de proteínas:** Estructura, enzimas, síntesis proteica
- **Tema de ácidos nucleicos:** ADN, ARN, expresión génica
- **Metabolismo:** Beta-oxidación, Ciclo de Krebs, Cadena de transporte electrónico
- **Grupos funcionales:** Se verán en detalle

### Aplicaciones prácticas:
- **Nutrición deportiva:** Entender cómo los macronutrientes (carbohidratos, lípidos, proteínas) se metabolizan y para qué sirven
- **Ayuno intermitente:** Comprender cómo activa la autofagia a nivel celular
- **Suplementación con electrolitos:** Importancia de Na⁺, K⁺, Mg²⁺, Ca²⁺ para el rendimiento muscular y nervioso
- **Transportador GLUT4:** Relevante para entender la captación de glucosa en el músculo (importante en diabetes y ejercicio)
- **Entrenamiento físico:** Estimula autofagia y múltiples rutas metabólicas simultáneamente

---

## 📚 NOTAS ADICIONALES DEL PROFESOR

> *"Este es uno de los temas más complejos porque se tratan muchos temas de química orgánica y muchos conceptos básicos de química"*

> *"Os animo a que le echéis un vistazo según vayáis viendo las diferentes clases, sobre todo las próximas dos clases"*

> *"Los conceptos de pH y pKa conviene repasar porque son un poquito más difíciles de entender, especialmente si no los habéis estudiado nunca"*

**Estructura de cada clase:**
1. Contenido teórico
2. Conceptos clave (resumen al final)
3. Ejercicios prácticos (si procede)
4. Preguntas de autoevaluación

**Consejo:** Hacer los ejercicios SIN mirar la respuesta primero, para "estrujarse la cabeza", y luego verificar con la solución propuesta.

---

*Documento generado siguiendo la metodología Cornell Notes para estudio autónomo.*`

async function main() {
  // Find T1 Bioquímica lesson
  const lesson = await prisma.lesson.findFirst({
    where: {
      subject: { name: { contains: 'Bioquímica' } },
      title: { contains: 'T1' }
    }
  })

  if (!lesson) {
    console.log('T1 Bioquímica lesson not found!')
    return
  }

  console.log('Found lesson:', lesson.id, lesson.title)

  // Restore the full Cornell notes
  await prisma.note.upsert({
    where: { id: `${lesson.id}-cornell-full` },
    create: {
      id: `${lesson.id}-cornell-full`,
      lessonId: lesson.id,
      content: T1_BIOQUIMICA_CONTENT
    },
    update: { content: T1_BIOQUIMICA_CONTENT }
  })

  console.log('✓ Restored T1 Bioquímica Cornell Notes -', T1_BIOQUIMICA_CONTENT.length, 'chars')
}

main().catch(console.error).finally(() => prisma.$disconnect())

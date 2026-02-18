import { prisma } from '../lib/db'

const CPE_SUBJECTS = [
  {
    id: 'biomecanica',
    name: 'Biomecánica y Anatomía Humana Aplicada al Entrenamiento',
    order: 1
  },
  {
    id: 'fisiologia',
    name: 'Fisiología Humana y su Respuesta al Ejercicio',
    order: 2
  },
  {
    id: 'principios',
    name: 'Principios del Entrenamiento y Adaptaciones al Ejercicio',
    order: 3
  },
  {
    id: 'hipertrofia',
    name: 'Entrenamiento para la Ganancia de Masa Muscular (Hipertrofia)',
    order: 4
  },
  {
    id: 'fuerza',
    name: 'Entrenamiento para la Mejora de la Fuerza Máxima',
    order: 5
  },
  {
    id: 'concurrente',
    name: 'Entrenamiento Concurrente / Híbrido',
    order: 6
  },
  {
    id: 'funcional',
    name: 'Entrenamiento Funcional',
    order: 7
  }
]

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444']
const ICONS = ['🦴', '💪', '⚙️', '🏋️', '🎯', '🔄', '🏃']

async function main() {
  console.log('🌱 Seeding CPE subjects...\n')

  // Ensure CPE program exists
  const program = await prisma.program.upsert({
    where: { id: 'cpe' },
    update: {
      name: 'CPE',
      fullName: 'Certificado Personal Trainer',
      description: 'Certificación profesional de entrenador personal',
      color: '#eab308',
      icon: '💪',
      order: 2
    },
    create: {
      id: 'cpe',
      name: 'CPE',
      fullName: 'Certificado Personal Trainer',
      description: 'Certificación profesional de entrenador personal',
      color: '#eab308',
      icon: '💪',
      order: 2
    }
  })
  console.log(`✅ CPE program ready: ${program.fullName}\n`)

  // Create subjects
  console.log('📚 Creating subjects:')
  const createdSubjects = []

  for (const subject of CPE_SUBJECTS) {
    const color = COLORS[(subject.order - 1) % COLORS.length]
    const icon = ICONS[(subject.order - 1) % ICONS.length]

    const result = await prisma.subject.upsert({
      where: { id: subject.id },
      update: {
        name: subject.name,
        semester: 1,
        order: subject.order,
        color,
        icon
      },
      create: {
        id: subject.id,
        name: subject.name,
        semester: 1,
        order: subject.order,
        color,
        icon,
        programId: program.id
      }
    })

    console.log(`  ${icon} ${result.id}: ${result.name}`)
    createdSubjects.push(result)
  }

  // Summary
  const totalSubjects = await prisma.subject.count({ where: { programId: program.id } })

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Program: ${program.fullName}`)
  console.log(`   - Subjects: ${totalSubjects}`)
  console.log('='.repeat(60))
  console.log('\n✨ CPE subjects seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

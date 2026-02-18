import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding programs...\n')

  // Create NHYD program
  const nhyd = await prisma.program.upsert({
    where: { id: 'nhyd' },
    update: {
      name: 'NHYD',
      fullName: 'Nutrición Humana y Dietética',
      description: 'Grado universitario en nutrición humana y dietética',
      color: '#10b981',
      icon: '🥗',
      order: 1,
    },
    create: {
      id: 'nhyd',
      name: 'NHYD',
      fullName: 'Nutrición Humana y Dietética',
      description: 'Grado universitario en nutrición humana y dietética',
      color: '#10b981',
      icon: '🥗',
      order: 1,
    },
  })
  console.log('✅ NHYD program created:', nhyd.fullName)

  // Create CPE program
  const cpe = await prisma.program.upsert({
    where: { id: 'cpe' },
    update: {
      name: 'CPE',
      fullName: 'Certificado Personal Trainer',
      description: 'Certificación profesional de entrenador personal',
      color: '#eab308',
      icon: '💪',
      order: 2,
    },
    create: {
      id: 'cpe',
      name: 'CPE',
      fullName: 'Certificado Personal Trainer',
      description: 'Certificación profesional de entrenador personal',
      color: '#eab308',
      icon: '💪',
      order: 2,
    },
  })
  console.log('✅ CPE program created:', cpe.fullName)

  // Link all existing subjects (without a program) to NHYD
  const result = await prisma.subject.updateMany({
    where: {
      programId: null,
    },
    data: {
      programId: nhyd.id,
    },
  })
  console.log(`\n✅ Linked ${result.count} existing subjects to NHYD program`)

  // Summary
  const nhydSubjects = await prisma.subject.count({ where: { programId: nhyd.id } })
  const cpeSubjects = await prisma.subject.count({ where: { programId: cpe.id } })

  console.log('\n📊 Summary:')
  console.log(`   - NHYD subjects: ${nhydSubjects}`)
  console.log(`   - CPE subjects: ${cpeSubjects}`)
  console.log('\n✨ Programs seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

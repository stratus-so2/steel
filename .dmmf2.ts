import { Prisma } from '@prisma/client'
const m = Prisma.dmmf.datamodel.models.find((x) => x.name === 'Membership')
console.log(JSON.stringify(m?.fields.find((f) => f.name === 'workspace')))

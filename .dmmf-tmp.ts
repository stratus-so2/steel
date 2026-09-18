import { Prisma } from '@prisma/client'

const models = Prisma.dmmf.datamodel.models
const scoped = new Set(
  models
    .filter((m) => m.fields.some((f) => f.name === 'workspaceId'))
    .map((m) => m.name),
)
console.log('scoped', scoped.size)
for (const m of models) {
  const ws = m.fields.find((f) => f.name === 'workspaceId')
  if (!ws) continue
  const rel = m.fields.find(
    (f) =>
      f.kind === 'object' &&
      f.type === 'Workspace' &&
      f.relationFromFields?.includes('workspaceId'),
  )
  if (!rel) console.log('NO-FK', m.name)
  else if (rel.relationOnDelete !== 'Cascade')
    console.log('FK', m.name, rel.relationOnDelete)
}
for (const m of models) {
  if (scoped.has(m.name) || m.name === 'Workspace') continue
  const rels = m.fields.filter(
    (f) =>
      f.kind === 'object' &&
      f.relationFromFields &&
      f.relationFromFields.length > 0,
  )
  const toScoped = rels.filter(
    (r) => scoped.has(r.type) || r.type === 'Workspace',
  )
  if (toScoped.length)
    console.log(
      'CHILD',
      m.name,
      toScoped
        .map(
          (r) =>
            `${r.name}:${r.type}:${r.relationFromFields}:${r.relationOnDelete}:${r.isRequired}`,
        )
        .join(' | '),
    )
}

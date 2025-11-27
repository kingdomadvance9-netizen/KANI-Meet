import React from 'react'

export default async function Meeting({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <div>My Post: {id}</div>
}


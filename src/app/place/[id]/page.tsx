import PlaceClient from "./PlaceClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlaceClient locationId={id} />;
}

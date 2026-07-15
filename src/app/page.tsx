import HomeClient from "./HomeClient";

/** デプロイ後に古いプリレンダーHTML／CDNキャッシュが残るのを防ぐ */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <HomeClient />;
}

import { Navigate, useParams } from "react-router";
import { InviteCard } from "src/components/InviteCard";

export function Join() {
  const { code } = useParams();

  if (!code) {
    return <Navigate to="/" />;
  }

  return (
    <div className="h-dvh w-dvw flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <InviteCard code={code} />
      </div>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile/")({
  component: () => null,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      throw redirect({ to: "/auth" });
    }
    const { data: u } = await supabase
      .from("users")
      .select("username")
      .eq("id", uid)
      .maybeSingle();
    if (u?.username) {
      throw redirect({
        to: "/profile/$username",
        params: { username: u.username },
      });
    }
    throw redirect({ to: "/" });
  },
});

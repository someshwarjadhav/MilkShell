import type * as React from "react";
import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ExternalLink, Hammer } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { flattenNav, useNav } from "../layout/nav";
import { PORTAL_URL } from "../services/config";

const FormPlaceholder: React.FC = () => {
  const { pathname } = useLocation();
  const sections = useNav();
  const leaf = useMemo(
    () => flattenNav(sections).find((l) => l.to === pathname),
    [sections, pathname],
  );
  const title = leaf?.label ?? "This screen";
  const portalUrl = leaf?.portalPath
    ? `${PORTAL_URL}${leaf.portalPath}`
    : PORTAL_URL;

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={
          leaf ? `${leaf.section} · available in the SmartX portal` : undefined
        }
      />
      <Card className="grid place-items-center gap-3 px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/12 text-brand">
          <Hammer size={26} />
        </span>
        <h2 className="font-display text-2xl font-extrabold">
          Coming to this dashboard soon
        </h2>
        <p className="max-w-md text-sm text-mute">
          You have access to <strong>{title}</strong>, but this screen is not
          built in the new dashboard yet. You can use it in the SmartX portal
          meanwhile.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <a href={portalUrl} target="_blank" rel="noreferrer">
            <Button icon={<ExternalLink size={16} />}>
              Open in SmartX portal
            </Button>
          </a>
          <Link to="/">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
export default FormPlaceholder;

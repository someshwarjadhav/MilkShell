import type * as React from 'react';
import { Link } from 'react-router-dom';
import { MilkCan } from '../components/Illustrations';
import { Button } from '../components/ui/Button';

const NotFound: React.FC = () => {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="flex flex-col items-center gap-3">
        <MilkCan size={96} className="animate-drift" />
        <h1 className="font-display text-5xl font-extrabold">Page spilled</h1>
        <p className="max-w-sm text-mute">This address does not exist. Go back to the dashboard to pick up where you left off.</p>
        <Link to="/"><Button>Back to dashboard</Button></Link>
      </div>
    </div>
  );
};

export default NotFound;

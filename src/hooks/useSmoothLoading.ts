import { useEffect, useRef, useState } from 'react';

export function useSmoothLoading(loading: boolean, delay = 150, minShow = 400): boolean {
  const [show, setShow] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (loading) {
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
    } else if (shownAt.current) {
      const left = Math.max(0, minShow - (Date.now() - shownAt.current));
      timer = setTimeout(() => {
        shownAt.current = 0;
        setShow(false);
      }, left);
    } else {
      setShow(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading, delay, minShow]);

  return show;
}

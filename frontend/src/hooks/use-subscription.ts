/**
 * Hook for subscribing to observables
 * Provides a clean way to use reactive state in React components
 */

import { useState, useEffect } from 'react';
import { Observable } from 'rxjs';

/**
 * A hook that subscribes to an Observable and returns its latest value
 * @param observable The Observable to subscribe to
 * @param initialValue The initial value to use before the Observable emits
 */
export function useSubscription<T>(observable: Observable<T>, initialValue: T): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const subscription = observable.subscribe(newValue => {
      setValue(newValue);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [observable]);

  return value;
}
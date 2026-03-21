import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';

const MACHINE_ID_KEY = 'jukebox_machine_id';

export function useMachineId() {
  const [machineId, setMachineId] = useState<string | null>(null);

  useEffect(() => {
    async function loadMachineId() {
      const { value } = await Preferences.get({ key: MACHINE_ID_KEY });
      if (value) {
        setMachineId(value);
      } else {
        const newId = crypto.randomUUID();
        await Preferences.set({ key: MACHINE_ID_KEY, value: newId });
        setMachineId(newId);
      }
    }
    loadMachineId();
  }, []);

  return machineId;
}

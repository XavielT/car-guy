import { T } from '@/components/T';
import { Card, GhostButton, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { FUEL_CATALOG } from '@/lib/fuel';
import { exportBackup, importBackup } from '@/lib/backup';
import { describeCounts } from '@/lib/import/tucombustible';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MasScreen() {
  const router = useRouter();
  const { data, activeVehicle, setActiveVehicle, resetAll, refresh } = useStore();

  async function handleExport() {
    try {
      const shared = await exportBackup();
      if (!shared) Alert.alert('Respaldo', 'Este dispositivo no permite compartir archivos.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      Alert.alert('Respaldo', `No se pudo crear el archivo de respaldo.\n\n${reason}`);
    }
  }

  async function handleImport() {
    try {
      const result = await importBackup();
      if (!result) return;
      await refresh();
      // A merge, never a wipe: rows are matched by id and the newer
      // updated_at wins, so restoring an old file cannot undo recent work.
      Alert.alert(
        'Datos restaurados',
        result.kind === 'legacy'
          ? `Importamos tus datos de Tu Combustible RD: ${describeCounts(result.counts)}.`
          : `Combinamos el respaldo: ${result.counts.merged} registros en ${result.counts.tables} tablas.`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      Alert.alert('Restaurar datos', reason);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={styles.h}>
          Más
        </T>
        <T face="body" style={styles.sub}>
          Vehículos, precios MICM de referencia y datos en este teléfono.
        </T>

        <T face="title" style={styles.sec}>
          Garaje
        </T>
        {data.vehicles.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => router.push({ pathname: '/vehiculo/[id]', params: { id: v.id } })}
            style={[styles.vcard, v.id === activeVehicle?.id && styles.vOn]}>
            <View style={{ flex: 1 }}>
              <T face="semibold" style={{ color: colors.ink, fontSize: 16 }}>
                {v.name}
              </T>
              <T face="body" style={styles.meta}>
                {v.plate ? `${v.plate} · ` : ''}
                {FUEL_CATALOG[v.defaultFuelType].label}
                {v.id === activeVehicle?.id ? ' · activo' : ''}
              </T>
            </View>
            {v.id === activeVehicle?.id ? null : (
              <GhostButton label="Activar" onPress={() => setActiveVehicle(v.id)} />
            )}
          </Pressable>
        ))}
        <PrimaryButton label="Agregar vehículo" onPress={() => router.push('/vehiculo/nuevo')} />

        <T face="title" style={styles.sec}>
          Referencia
        </T>
        <Card>
          <T face="semibold">Precios oficiales de la semana</T>
          <T face="body" style={styles.meta}>
            {data.settings.priceWeekLabel}. Sirven para comparar; cada carga guarda lo que pagaste.
          </T>
          <Pressable onPress={() => router.push('/precios')} style={{ marginTop: 10 }}>
            <T face="bold" style={{ color: colors.nozzle }}>
              Editar precios de referencia
            </T>
          </Pressable>
        </Card>
        <PrimaryButton label="Registrar mantenimiento" onPress={() => router.push('/servicio/nuevo')} />
        <GhostButton label="Registrar gasto" onPress={() => router.push('/gasto/nuevo')} />
        <GhostButton label="Tareas pendientes" onPress={() => router.push('/tareas')} />
        <GhostButton label="Documentos" onPress={() => router.push('/documentos')} />

        <T face="title" style={styles.sec}>
          Datos
        </T>
        <T face="body" style={styles.meta}>
          Todo vive en este dispositivo. No hay cuenta ni nube.
        </T>
        <PrimaryButton label="Crear respaldo JSON" onPress={handleExport} />
        <GhostButton label="Restaurar o importar respaldo" onPress={handleImport} />
        <T face="body" style={styles.meta}>
          Acepta respaldos de Car Guy y de Tu Combustible RD. Guarda el archivo en Drive, correo o
          tu computadora antes de desinstalar la app.
        </T>
        <GhostButton
          danger
          label="Borrar todos los datos"
          onPress={() =>
            Alert.alert('Borrar todo', 'Se van vehículos y cargas. No hay marcha atrás.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Borrar', style: 'destructive', onPress: resetAll },
            ])
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.receipt },
  pad: { padding: 20, paddingBottom: 48 },
  h: { fontSize: 36, color: colors.ink },
  sub: { color: colors.muted, marginTop: 6, marginBottom: 8, lineHeight: 22 },
  sec: { fontSize: 22, color: colors.ink, marginTop: 24, marginBottom: 12 },
  meta: { color: colors.muted, marginTop: 4, lineHeight: 20, fontSize: 13 },
  vcard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  vOn: { borderColor: colors.teal },
});

import { BookkeepingEventsTable } from "./BookkeepingEventsTable";

interface BokforingTabProps {
  vehicleId: string;
}

export const BokforingTab = ({ vehicleId }: BokforingTabProps) => {
  return (
    <div className="w-full">
      <BookkeepingEventsTable vehicleId={vehicleId} />
    </div>
  );
};
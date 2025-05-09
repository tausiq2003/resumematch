import { FormProvider } from "../context/FormContext";
import DashBoard from "./dashboard";
export default function ParentDashboard() {
    return (
        <FormProvider>
            <DashBoard />
        </FormProvider>
    );
}

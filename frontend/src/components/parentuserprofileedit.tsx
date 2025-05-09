import { FormProvider } from "../context/FormContext";
import UserProfileEdit from "./userprofileedit";

export default function ParentUserProfileEdit() {
    return (
        <FormProvider>
            <UserProfileEdit />
        </FormProvider>
    );
}

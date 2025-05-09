import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function LoginSkeleton() {
    return (
        <div className=" px-6 py-4 max-w-[400px]  rounded-md text-center shadow-lg">
            <Skeleton
                baseColor="#e0e0e0"
                highlightColor="#f5f5f5"
                height={25}
                className="max-w-[50%]"
            />
            <Skeleton
                baseColor="#e0e0e0"
                highlightColor="#f5f5f5"
                className="max-w-[75%]"
            />

            <Skeleton
                baseColor="#e0e0e0"
                highlightColor="#f5f5f5"
                height={35}
                className="max-w-[75%]"
            />

            <Skeleton
                baseColor="#e0e0e0"
                highlightColor="#f5f5f5"
                className="my-8 max-w-[75%]"
            />

            <Skeleton
                baseColor="#e0e0e0"
                highlightColor="#f5f5f5"
                width={150}
                className="-left-[30px]"
            />

            <Skeleton
                baseColor="#e0e0e0"
                highlightColor="#f5f5f5"
                height={35}
                className="mb-8 max-w-[75%]"
            />

            <Skeleton
                baseColor="#e0e0e0"
                highlightColor="#f5f5f5"
                height={35}
                className="max-w-[75%]"
            />
        </div>
    );
}

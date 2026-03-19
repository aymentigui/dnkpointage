import { useEffect, useRef, useState } from "react";
import { Camera, Trash, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getImageFromLocalHost } from "@/actions/localstorage/util-client";
import MyImage from "./my-image";

interface AvatarUploaderProps {
  name: string;
  image?: string | null;
  circle?: boolean;
  size?: string;
  setIsChanged?: any
}

export default function AvatarUploader({ name, image, circle = true, size, setIsChanged }: AvatarUploaderProps) {
  const { control, setValue } = useFormContext();
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (image)
      getImageFromLocalHost(image)
        .then((val) => {
          setPreview(val)
        })
  }, [image])

  const handleDeletePreview = (e: any) => {
    setValue(name, undefined)
    setPreview(null)
    if(setIsChanged) setIsChanged(true)
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setValue(name, file);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormControl>
            <div className={"relative " + (size ? size : "w-24 h-24")} >
              <Input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageChange}
              />
              {preview && <Trash onClick={handleDeletePreview} size={1} className="h-6  w-6 p-1 rounded-lg cursor-pointer text-white bg-red-600 hover:bg-red-300 absolute top-4 right-2 z-50" />}
              <div
                className={cn(
                  "border flex items-center justify-center cursor-pointer relative overflow-hidden",
                  "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 transition-all",
                  circle ? "rounded-full" : "rounded-md",
                  size ? size : "w-24 h-24"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                {preview ?
                  <MyImage
                    image={preview}
                    isNotApi
                    alt="Avatar"
                    classNameProps={"object-cover " + (size ? size : " w-24 h-24 ") + (circle ? " rounded-full" : " rounded-md")}
                  />
                  : (
                    <Upload className="w-10 h-10 text-gray-500" />
                  )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

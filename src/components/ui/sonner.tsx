import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:p-3 group-[.toaster]:min-h-0 group-[.toaster]:w-auto group-[.toaster]:min-w-[280px] group-[.toaster]:max-w-[400px]",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:h-7 group-[.toast]:px-3 group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:h-7 group-[.toast]:px-3 group-[.toast]:text-xs group-[.toast]:font-medium",
          closeButton: "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-foreground group-[.toast]:hover:bg-muted group-[.toast]:hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

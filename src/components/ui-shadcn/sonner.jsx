import { useTheme } from "@/context/ThemeContext"
import { Toaster as Sonner } from "sonner";
import { CheckCircle, InfoCircle, AlertTriangle, AlertHexagon, Loading02 } from "@untitledui/icons"

const Toaster = ({
  ...props
}) => {
  const { theme = "light" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CheckCircle className="size-4 text-success" />
        ),
        info: (
          <InfoCircle className="size-4 text-muted-foreground" />
        ),
        warning: (
          <AlertTriangle className="size-4 text-warning" />
        ),
        error: (
          <AlertHexagon className="size-4 text-destructive" />
        ),
        loading: (
          <Loading02 className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)"
        }
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }
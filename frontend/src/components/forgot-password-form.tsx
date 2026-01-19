import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    forgotPasswordSchema,
    type ForgotPasswordFormData,
} from "@/schemas/auth.schema";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm({
    className,
    ...props
}: React.ComponentProps<"form">) {
    const form = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSubmit = (data: ForgotPasswordFormData) => {
        console.log("Forgot password data:", data);
        // TODO: Implement forgot password API call
    };

    return (
        <Form {...form}>
            <form
                className={cn("flex flex-col gap-6", className)}
                onSubmit={form.handleSubmit(onSubmit)}
                {...props}
            >
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-1 text-center">
                        <h1 className="text-2xl font-bold">Forgot password?</h1>
                        <p className="text-muted-foreground text-sm text-balance">
                            Enter your email and we'll send you a reset link
                        </p>
                    </div>

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="m@example.com"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                    >
                        {form.formState.isSubmitting
                            ? "Sending..."
                            : "Send Reset Link"}
                    </Button>

                    <p className="px-6 text-center text-sm text-muted-foreground">
                        Remember your password?{" "}
                        <Link
                            to="/login"
                            className="underline underline-offset-4 hover:text-primary"
                        >
                            Back to login
                        </Link>
                    </p>
                </div>
            </form>
        </Form>
    );
}

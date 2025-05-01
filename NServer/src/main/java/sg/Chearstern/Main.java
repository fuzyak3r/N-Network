package sg.Chearstern;

import lombok.SneakyThrows;

public class Main {
    @SneakyThrows
    public static void main(String[] args) {
        Server server = new Server(30486);
        server.start();
    }
}
#pragma glslify: blinnPhongSpec = require(glsl-specular-phong)

uniform vec3 eyePosition;
uniform vec3 lightPosition;

uniform float uShininess;

varying vec3 ecPosition;
varying vec3 ecNormal;
varying vec3 ecLightPosition;

void main() {
    vec3 ecEyePos = vec3(0.0, 0.0, 0.0);
    vec3 viewDirection = normalize(ecEyePos - ecPosition);

    vec3 lightDirection = normalize(ecLightPosition - ecPosition);
    vec3 normal = normalize(ecNormal);

    float power = blinnPhongSpec(lightDirection, viewDirection, normal, uShininess);

    gl_FragColor = vec4(power,power,power,1.0);
}
